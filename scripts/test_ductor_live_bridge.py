#!/usr/bin/env python3
"""Tests for ductor-live-bridge.py role extraction from log context prefix.

TDD RED: These tests should FAIL with the current bridge code that maps
label=main -> Alec, because label=main is emitted for ALL agents.
The context prefix [kevin:msg:...], [benjamin:msg:...], [main:msg:]
is the actual identity signal.
"""
import json
import os
import pathlib
import stat
import tempfile
import unittest

# Import the bridge module
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ductor_live_bridge",
    pathlib.Path(__file__).parent / "ductor-live-bridge.py",
)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class TestRoleFromLine(unittest.TestCase):
    """Extract agent role from log line context prefix."""

    def test_kevin_start_line(self):
        """[kevin:msg:...] CLI streaming starting label=main -> Kevin working."""
        line = (
            "2026-08-30 10:46:48 [INFO] ductor_bot.cli.service:service.py:231: "
            "[kevin:msg:8758884986:ses_faf8] CLI streaming starting label=main "
            "model=opencode/mimo-v2.5-free"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Kevin")
        self.assertEqual(state, "working")

    def test_kevin_complete_line(self):
        """[kevin:msg:...] CLI streaming completed label=main -> Kevin idle."""
        line = (
            "2026-08-30 10:47:21 [INFO] ductor_bot.cli.service:service.py:292: "
            "[kevin:msg:8758884986:ses_faf8] CLI streaming completed label=main "
            "fallback=False timed_out=False"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Kevin")
        self.assertEqual(state, "idle")

    def test_benjamin_start_line(self):
        """[benjamin:msg:...] CLI streaming starting label=main -> Benjamin working."""
        line = (
            "2026-08-30 10:46:50 [INFO] ductor_bot.cli.service:service.py:231: "
            "[benjamin:msg:8758884986:60d04d34] CLI streaming starting label=main "
            "model=copilot-default"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Benjamin")
        self.assertEqual(state, "working")

    def test_benjamin_complete_line(self):
        """[benjamin:msg:...] CLI streaming completed label=main -> Benjamin idle."""
        line = (
            "2026-08-30 10:47:10 [INFO] ductor_bot.cli.service:service.py:292: "
            "[benjamin:msg:8758884986:60d04d34] CLI streaming completed label=main "
            "fallback=False timed_out=False"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Benjamin")
        self.assertEqual(state, "idle")

    def test_main_start_line(self):
        """[main:msg:...] CLI streaming starting label=main -> Alec working."""
        line = (
            "2026-08-30 10:46:55 [INFO] ductor_bot.cli.service:service.py:231: "
            "[main:msg:8758884986:01a0507e] CLI streaming starting label=main "
            "model=gpt-5.6-luna"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Alec")
        self.assertEqual(state, "working")

    def test_main_complete_line(self):
        """[main:msg:...] CLI streaming completed label=main -> Alec idle."""
        line = (
            "2026-08-30 10:47:30 [INFO] ductor_bot.cli.service:service.py:292: "
            "[main:msg:8758884986:01a0507e] CLI streaming completed label=main "
            "fallback=False timed_out=False"
        )
        role, state = bridge.parse_line(line)
        self.assertEqual(role, "Alec")
        self.assertEqual(state, "idle")

    def test_unrelated_line_returns_none(self):
        """Non-streaming lines should return (None, None)."""
        line = (
            "2026-08-30 10:46:48 [INFO] ductor_bot.orchestrator.core:core.py:363: "
            "[kevin:msg:8758884986] Message received text=alo"
        )
        role, state = bridge.parse_line(line)
        self.assertIsNone(role)
        self.assertIsNone(state)

    def test_malformed_line_returns_none(self):
        """Malformed or missing context prefix should return (None, None)."""
        line = "some random log line without context prefix CLI streaming starting label=main"
        role, state = bridge.parse_line(line)
        self.assertIsNone(role)
        self.assertIsNone(state)

    def test_kevin_start_does_not_route_to_alec(self):
        """label=main in kevin line must NOT route to Alec."""
        line = (
            "2026-08-30 10:46:48 [INFO] ductor_bot.cli.service:service.py:231: "
            "[kevin:msg:8758884986:ses_faf8] CLI streaming starting label=main"
        )
        role, state = bridge.parse_line(line)
        self.assertNotEqual(role, "Alec")
        self.assertEqual(role, "Kevin")


class TestStreamTrackingAndRefcounting(unittest.TestCase):
    """Verify multi-stream refcounting, terminal outcomes, and out-of-order handling."""

    def test_concurrent_streams_refcount(self):
        tracker = bridge.BridgeStateTracker()
        line_start_1 = "[kevin:msg:chat1:stream1] CLI streaming starting label=main"
        line_start_2 = "[kevin:msg:chat1:stream2] CLI streaming starting label=main"
        line_done_1 = "[kevin:msg:chat1:stream1] CLI streaming completed label=main"
        line_done_2 = "[kevin:msg:chat1:stream2] CLI streaming completed label=main"

        # Start stream 1 -> working
        tracker.process_line(line_start_1)
        self.assertEqual(tracker.role_state["Kevin"], "working")

        # Start stream 2 -> working
        tracker.process_line(line_start_2)
        self.assertEqual(tracker.role_state["Kevin"], "working")

        # Stream 1 completes -> still working because stream 2 is active
        tracker.process_line(line_done_1)
        self.assertEqual(tracker.role_state["Kevin"], "working")

        # Stream 2 completes -> idle
        tracker.process_line(line_done_2)
        self.assertEqual(tracker.role_state["Kevin"], "idle")

    def test_terminal_failure_and_error_states(self):
        tracker = bridge.BridgeStateTracker()
        tracker.process_line("[alec:msg:chat1:s1] CLI streaming starting label=main")
        # Should be None because Alec is mapped from 'main'
        tracker.process_line("[main:msg:chat1:s1] CLI streaming starting label=main")
        self.assertEqual(tracker.role_state["Alec"], "working")

        # Stream fails -> returns to idle
        tracker.process_line("[main:msg:chat1:s1] CLI streaming failed label=main")
        self.assertEqual(tracker.role_state["Alec"], "idle")

    def test_prune_stale_streams(self):
        fake_time = 1000.0
        tracker = bridge.BridgeStateTracker()
        tracker.process_line("[benjamin:msg:c1:s1] CLI streaming starting label=main", event_time=fake_time)
        self.assertEqual(tracker.role_state["Benjamin"], "working")

        # Before timeout: still working
        changed = tracker.prune_stale_streams(max_age_s=100, now_s=fake_time + 50)
        self.assertFalse(changed)
        self.assertEqual(tracker.role_state["Benjamin"], "working")

        # After timeout: pruned to idle
        changed = tracker.prune_stale_streams(max_age_s=100, now_s=fake_time + 150)
        self.assertTrue(changed)
        self.assertEqual(tracker.role_state["Benjamin"], "idle")


class TestRestartPreservation(unittest.TestCase):
    """Verify preserving state across restart without false all-idle resets."""

    def test_preserves_initial_status(self):
        initial = {
            "version": 1,
            "roles": {
                "Alec": {"state": "idle", "updatedAt": "2026-08-30T10:00:00.000Z"},
                "Kevin": {"state": "working", "updatedAt": "2026-08-30T10:30:00.000Z"},
                "Benjamin": {"state": "review", "updatedAt": "2026-08-30T10:40:00.000Z"},
            },
        }
        tracker = bridge.BridgeStateTracker(initial_status=initial)
        snap = tracker.get_snapshot()
        self.assertEqual(snap["roles"]["Kevin"]["state"], "working")
        self.assertEqual(snap["roles"]["Kevin"]["updatedAt"], "2026-08-30T10:30:00.000Z")
        self.assertEqual(snap["roles"]["Benjamin"]["state"], "review")
        self.assertEqual(snap["roles"]["Benjamin"]["updatedAt"], "2026-08-30T10:40:00.000Z")


class TestWriteStatus(unittest.TestCase):
    """Verify atomic status file writes."""

    def test_write_status_creates_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out = pathlib.Path(tmpdir) / "status.json"
            bridge.write_status_testable(
                {"Alec": "idle", "Kevin": "working", "Benjamin": "idle"}, out
            )
            doc = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(doc["version"], 1)
            self.assertEqual(doc["roles"]["Alec"]["state"], "idle")
            self.assertEqual(doc["roles"]["Kevin"]["state"], "working")
            self.assertEqual(doc["roles"]["Benjamin"]["state"], "idle")

    def test_write_status_private_permissions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out = pathlib.Path(tmpdir) / "sub" / "status.json"
            bridge.write_status_testable(
                {"Alec": "idle", "Kevin": "idle", "Benjamin": "idle"}, out
            )
            file_mode = stat.S_IMODE(out.stat().st_mode)
            dir_mode = stat.S_IMODE(out.parent.stat().st_mode)
            self.assertEqual(file_mode & 0o077, 0)
            self.assertEqual(dir_mode & 0o077, 0)


class TestReplayLog(unittest.TestCase):
    """Verify log replay on startup."""

    def test_replay_window_restores_active_streams(self):
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as f:
            f.write(
                "2026-08-30 10:46:48 [INFO] ductor_bot.cli.service:service.py:231: "
                "[kevin:msg:8758884986:ses_1] CLI streaming starting label=main\n"
            )
            f.write(
                "2026-08-30 10:46:50 [INFO] ductor_bot.cli.service:service.py:231: "
                "[benjamin:msg:8758884986:ses_2] CLI streaming starting label=main\n"
            )
            f.write(
                "2026-08-30 10:47:10 [INFO] ductor_bot.cli.service:service.py:292: "
                "[benjamin:msg:8758884986:ses_2] CLI streaming completed label=main\n"
            )
            f.flush()
            temp_path = f.name

        try:
            tracker = bridge.BridgeStateTracker()
            bridge.replay_log_window(temp_path, tracker)
            self.assertEqual(tracker.role_state["Kevin"], "working")
            self.assertEqual(tracker.role_state["Benjamin"], "idle")
            self.assertEqual(tracker.role_state["Alec"], "idle")
        finally:
            pathlib.Path(temp_path).unlink(missing_ok=True)

    def test_replay_bounded_window_discards_partial_initial_line(self):
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as f:
            f.write("A" * 1000 + "\n")
            f.write(
                "2026-08-30 10:46:48 [INFO] ductor_bot.cli.service:service.py:231: "
                "[kevin:msg:chat:stream1] CLI streaming starting label=main\n"
            )
            f.flush()
            temp_path = f.name

        try:
            tracker = bridge.BridgeStateTracker()
            # Pass a small window_bytes so that it seeks into the middle of the first line
            bridge.replay_log_window(temp_path, tracker, window_bytes=200)
            self.assertEqual(tracker.role_state["Kevin"], "working")
        finally:
            pathlib.Path(temp_path).unlink(missing_ok=True)


class TestBridgeLockAndExplicitPaths(unittest.TestCase):
    """Verify lock acquisition, single-instance enforcement, and explicit path invocation."""

    def test_single_instance_lock(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            lock_path = pathlib.Path(tmpdir) / ".bridge.lock"
            fd1 = bridge.acquire_lock(lock_path)
            self.assertIsNotNone(fd1)

            # Second acquire must fail with RuntimeError
            with self.assertRaises(RuntimeError):
                bridge.acquire_lock(lock_path)

            # Releasing lock allows new acquire
            bridge.release_lock(fd1)
            fd2 = bridge.acquire_lock(lock_path)
            self.assertIsNotNone(fd2)
            bridge.release_lock(fd2)

    def test_run_bridge_once_with_explicit_paths(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_p = pathlib.Path(tmpdir) / "agent.log"
            out_p = pathlib.Path(tmpdir) / "sub" / "status.json"
            lock_p = pathlib.Path(tmpdir) / "sub" / ".bridge.lock"

            log_p.write_text(
                "2026-08-30 10:46:55 [INFO] [main:msg:chat:s1] CLI streaming starting label=main\n",
                encoding="utf-8",
            )

            snap = bridge.run_bridge(log_p, out_p, lock_p, once=True)
            self.assertEqual(snap["roles"]["Alec"]["state"], "working")
            self.assertEqual(snap["roles"]["Kevin"]["state"], "idle")
            self.assertEqual(snap["roles"]["Benjamin"]["state"], "idle")
            self.assertTrue(out_p.exists())

    def test_keepalive_does_not_refresh_unchanged_timestamps(self):
        fake_time = 2000.0
        iso_fixed = "2026-08-30T10:00:00.000Z"
        tracker = bridge.BridgeStateTracker(
            initial_status={
                "version": 1,
                "roles": {
                    "Alec": {"state": "idle", "updatedAt": iso_fixed},
                    "Kevin": {"state": "idle", "updatedAt": iso_fixed},
                    "Benjamin": {"state": "idle", "updatedAt": iso_fixed},
                },
            }
        )

        changed = tracker.prune_stale_streams(max_age_s=100, now_s=fake_time + 1000)
        self.assertFalse(changed)
        snap = tracker.get_snapshot()
        self.assertEqual(snap["roles"]["Alec"]["updatedAt"], iso_fixed)
        self.assertEqual(snap["roles"]["Kevin"]["updatedAt"], iso_fixed)
        self.assertEqual(snap["roles"]["Benjamin"]["updatedAt"], iso_fixed)


if __name__ == "__main__":
    unittest.main()
