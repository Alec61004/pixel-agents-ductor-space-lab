#!/usr/bin/env python3
"""Bridge real bot activity (ductor agent.log) into the Space Lab status file.

Watches ~/.ductor/logs/agent.log for per-agent CLI lifecycle start/complete events
and maintains .ductor-space-lab/status.json.
Tracks active stream IDs per role to prevent out-of-order completions from hiding
active streams, preserves truthful evidence timestamps, and handles restart/rotation.
"""
import argparse
import fcntl
import json
import os
import pathlib
import re
import sys
import time
import uuid

LOG = pathlib.Path(os.environ.get('DUCTOR_LOG_FILE', pathlib.Path.home() / '.ductor/logs/agent.log'))
OUT = pathlib.Path(os.environ.get('DUCTOR_STATUS_FILE', pathlib.Path.home() / '.ductor/workspace/projects/pixel-agents-ductor-lab/.ductor-space-lab/status.json'))
LOCK_FILE = pathlib.Path(os.environ.get('DUCTOR_LOCK_FILE', pathlib.Path.home() / '.ductor/workspace/projects/pixel-agents-ductor-lab/.ductor-space-lab/.bridge.lock'))

ALL_ROLES = ('Alec', 'Kevin', 'Benjamin')
CtxRole = {'main': 'Alec', 'kevin': 'Kevin', 'benjamin': 'Benjamin'}
CTX_RE = re.compile(r'\[([a-z]+):msg(?::([^\]\s]+))?\]')
BUS_START_RE = re.compile(r'Bus async: main -> (kevin|benjamin) task=([A-Za-z0-9_-]+)')
BUS_DONE_RE = re.compile(r'Bus async: main -> (kevin|benjamin) task=([A-Za-z0-9_-]+) session=.* completed')
START_RE = re.compile(r'CLI streaming starting label=')
DONE_RE = re.compile(r'CLI streaming completed label=')
FAIL_RE = re.compile(r'CLI streaming (?:failed|error|cancelled|timed out) label=')
EXECUTE_START_RE = re.compile(r'CLI execute starting label=')
EXECUTE_DONE_RE = re.compile(r'CLI main \[(?:ok|error)\]')

KEEPALIVE_S = 240  # 4 min keepalive check interval
ACTIVE_STREAM_TIMEOUT_S = 45 * 60  # 45 min max active stream duration before fail-closed idle
REPLAY_WINDOW_BYTES = 64 * 1024  # 64 KB startup log replay window


def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())


def acquire_lock(lock_path=None):
    """Acquire exclusive non-blocking file lock to prevent multiple bridge instances."""
    target = pathlib.Path(lock_path) if lock_path else LOCK_FILE
    target_dir = target.parent
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(target_dir, 0o700)
    except OSError:
        pass
    fd = os.open(target, os.O_RDWR | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (BlockingIOError, OSError) as e:
        os.close(fd)
        raise RuntimeError(f"Could not acquire bridge lock on {target}: another instance is running") from e
    return fd


def release_lock(fd):
    """Release and close lock file descriptor."""
    if fd is not None:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass
        try:
            os.close(fd)
        except OSError:
            pass


def parse_line(line):
    """Extract (role, state) from a log line using context prefix.

    Returns (None, None) for lines that don't match the expected pattern.
    The context prefix [kevin:msg:...] identifies the agent, NOT label=main.
    """
    event = parse_lifecycle_event(line)
    if not event:
        return None, None
    return event['role'], event['state']


def parse_lifecycle_event(line):
    """Detailed parser extracting role, state, stream_id, and terminal flags."""
    bus_done = BUS_DONE_RE.search(line)
    if bus_done:
        return {
            'role': CtxRole[bus_done.group(1)],
            'state': 'idle',
            'stream_id': f'ia:{bus_done.group(2)}',
            'event': 'done',
        }

    bus_start = BUS_START_RE.search(line)
    if bus_start:
        return {
            'role': CtxRole[bus_start.group(1)],
            'state': 'working',
            'stream_id': f'ia:{bus_start.group(2)}',
            'event': 'start',
        }

    cm = CTX_RE.search(line)
    if not cm:
        return None
    role_key = cm.group(1)
    role = CtxRole.get(role_key)
    if not role:
        return None

    stream_id = cm.group(2) or 'default'

    if START_RE.search(line) or EXECUTE_START_RE.search(line):
        return {
            'role': role,
            'state': 'working',
            'stream_id': stream_id,
            'event': 'start',
        }
    if DONE_RE.search(line) or FAIL_RE.search(line) or EXECUTE_DONE_RE.search(line):
        return {
            'role': role,
            'state': 'idle',
            'stream_id': stream_id,
            'event': 'done',
        }
    return None


class BridgeStateTracker:
    """Manages active streams per role and generates truthful status snapshots."""

    def __init__(self, initial_status=None, now_fn=now_iso):
        self.now_fn = now_fn
        self.role_state = {}
        self.role_updated_at = {}
        self.active_streams = {r: {} for r in ALL_ROLES}  # role -> {stream_id: start_time}

        default_now = self.now_fn()
        for r in ALL_ROLES:
            self.role_state[r] = 'idle'
            self.role_updated_at[r] = default_now

        if initial_status and isinstance(initial_status, dict):
            roles = initial_status.get('roles', {})
            for r in ALL_ROLES:
                if r in roles and isinstance(roles[r], dict):
                    st = roles[r].get('state')
                    up = roles[r].get('updatedAt')
                    if st in ('idle', 'working', 'waiting', 'review', 'blocked', 'offline'):
                        self.role_state[r] = st
                    if up and isinstance(up, str):
                        self.role_updated_at[r] = up

    def process_line(self, line, event_time=None):
        evt = parse_lifecycle_event(line)
        if not evt:
            return False

        role = evt['role']
        stream_id = evt['stream_id']
        t = event_time or time.time()
        iso_t = self.now_fn()

        if evt['event'] == 'start':
            self.active_streams[role][stream_id] = t
            self.role_state[role] = 'working'
            self.role_updated_at[role] = iso_t
            return True
        elif evt['event'] == 'done':
            self.active_streams[role].pop(stream_id, None)
            if not self.active_streams[role]:
                self.role_state[role] = 'idle'
                self.role_updated_at[role] = iso_t
                return True
        return False

    def prune_stale_streams(self, max_age_s=ACTIVE_STREAM_TIMEOUT_S, now_s=None):
        now_s = now_s or time.time()
        changed = False
        for role in ALL_ROLES:
            expired = [
                sid for sid, started_at in self.active_streams[role].items()
                if now_s - started_at > max_age_s
            ]
            for sid in expired:
                self.active_streams[role].pop(sid, None)
            if expired and not self.active_streams[role] and self.role_state[role] == 'working':
                self.role_state[role] = 'idle'
                self.role_updated_at[role] = self.now_fn()
                changed = True
        return changed

    def get_snapshot(self):
        doc = {'version': 1, 'roles': {}}
        for r in ALL_ROLES:
            doc['roles'][r] = {
                'state': self.role_state[r],
                'updatedAt': self.role_updated_at[r],
            }
        return doc


def read_existing_status(path=None):
    """Read existing status file to preserve state across bridge restarts."""
    target = pathlib.Path(path) if path else OUT
    if not target.exists():
        return None
    try:
        data = json.loads(target.read_text(encoding='utf-8'))
        if isinstance(data, dict) and data.get('version') == 1 and 'roles' in data:
            return data
    except Exception:
        pass
    return None


def write_status(states_or_doc, out=None, role_updated_at=None):
    """Atomic write of status.json using private permissions (0700/0600) and unique temp file."""
    target = pathlib.Path(out) if out else OUT
    target_dir = target.parent
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(target_dir, 0o700)
    except OSError:
        pass

    if isinstance(states_or_doc, dict) and 'version' in states_or_doc and 'roles' in states_or_doc:
        doc = states_or_doc
    else:
        now = now_iso()
        doc = {'version': 1, 'roles': {}}
        for role in ALL_ROLES:
            if isinstance(states_or_doc.get(role), dict):
                doc['roles'][role] = {
                    'state': states_or_doc[role].get('state', 'idle'),
                    'updatedAt': states_or_doc[role].get('updatedAt', now),
                }
            else:
                up = (role_updated_at.get(role) if role_updated_at else None) or now
                doc['roles'][role] = {
                    'state': states_or_doc.get(role, 'idle'),
                    'updatedAt': up,
                }

    serialized = json.dumps(doc, indent=1) + '\n'
    tmp = target_dir / f'.{target.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp'
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with open(fd, 'w', encoding='utf-8') as f:
            f.write(serialized)
            f.flush()
            os.fsync(fd)
        os.replace(tmp, target)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def write_status_testable(states, out):
    """write_status variant that accepts an explicit output path for testing."""
    write_status(states, out)


def replay_log_window(log_path, tracker, window_bytes=REPLAY_WINDOW_BYTES):
    """Replay a bounded trailing window of the log file on startup to restore stream states."""
    path = pathlib.Path(log_path)
    if not path.exists():
        return
    try:
        file_size = path.stat().st_size
        offset = max(0, file_size - window_bytes)
        with path.open('r', encoding='utf-8', errors='replace') as fh:
            if offset > 0:
                fh.seek(offset)
                fh.readline()  # Discard partial line
            for line in fh:
                tracker.process_line(line)
    except Exception:
        pass


def parse_args(args=None):
    parser = argparse.ArgumentParser(description="Ductor Live Bridge")
    parser.add_argument("--log", type=pathlib.Path, default=LOG, help="Path to ductor agent.log")
    parser.add_argument("--out", type=pathlib.Path, default=OUT, help="Path to status.json output")
    parser.add_argument("--lock", type=pathlib.Path, default=LOCK_FILE, help="Path to lock file")
    parser.add_argument("--once", action="store_true", help="Run initial replay, write status once, and exit")
    return parser.parse_args(args)


def run_bridge(log_path, out_path, lock_path, once=False):
    lock_fd = acquire_lock(lock_path)
    log_path = pathlib.Path(log_path)
    out_path = pathlib.Path(out_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    existing = read_existing_status(out_path)
    tracker = BridgeStateTracker(initial_status=existing)

    if log_path.exists():
        replay_log_window(log_path, tracker)

    write_status(tracker.get_snapshot(), out=out_path)

    if once:
        release_lock(lock_fd)
        return tracker.get_snapshot()

    last_prune = time.time()
    current_inode = None
    current_size = 0
    fh = None

    try:
        if log_path.exists():
            st = log_path.stat()
            current_inode = st.st_ino
            current_size = st.st_size
            fh = log_path.open('r', encoding='utf-8', errors='replace')
            fh.seek(0, 2)

        while True:
            if not log_path.exists():
                if fh:
                    fh.close()
                    fh = None
                time.sleep(1)
                continue

            st = log_path.stat()
            # Handle log rotation or truncation
            if fh is None or st.st_ino != current_inode or st.st_size < current_size:
                if fh:
                    fh.close()
                current_inode = st.st_ino
                current_size = st.st_size
                fh = log_path.open('r', encoding='utf-8', errors='replace')
                fh.seek(max(0, st.st_size - REPLAY_WINDOW_BYTES))
                if st.st_size > REPLAY_WINDOW_BYTES:
                    fh.readline()  # Discard partial line

            line = fh.readline()
            current_size = fh.tell()

            if not line:
                time.sleep(1)
                now_s = time.time()
                if now_s - last_prune >= KEEPALIVE_S:
                    if tracker.prune_stale_streams(now_s=now_s):
                        write_status(tracker.get_snapshot(), out=out_path)
                    last_prune = now_s
                continue

            if tracker.process_line(line):
                write_status(tracker.get_snapshot(), out=out_path)
                snap = tracker.get_snapshot()
                roles_summary = ", ".join(f"{r}={snap['roles'][r]['state']}" for r in ALL_ROLES)
                print(f'[bridge] Updated status: {roles_summary}', flush=True)

    finally:
        if fh:
            fh.close()
        release_lock(lock_fd)


def main():
    args = parse_args()
    run_bridge(args.log, args.out, args.lock, once=args.once)


if __name__ == '__main__':
    main()
