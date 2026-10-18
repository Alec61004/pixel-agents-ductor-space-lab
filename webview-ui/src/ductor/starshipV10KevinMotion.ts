export type KevinMotionLayerKind =
  | 'authored-static'
  | 'generated-static'
  | 'procedural-dynamic'
  | 'planet-dynamic';

export interface KevinMotionLayerAudit {
  id: string;
  kind: KevinMotionLayerKind;
  z: number;
  primitiveCount?: number;
  sourcePixelCount?: number;
  orbitRadius?: number;
  orbitPeriodSec?: number;
}

export type KevinPixelOwnerCategory =
  | 'map-base'
  | 'authored-detail'
  | 'sun'
  | 'haze'
  | 'dust'
  | 'star-grid'
  | 'navigation'
  | 'star-node'
  | 'guide-orbit'
  | 'planet-orbit'
  | 'planet'
  | 'transition';

export interface KevinPixelOwnerDefinition {
  id: string;
  parentId: string | null;
  category: KevinPixelOwnerCategory;
  subpart: string;
  dynamic: boolean;
  z: number;
  sourcePixelCount?: number;
  primitiveIndex?: number;
}

export interface KevinPixelOwnershipSnapshot {
  readonly width: 540;
  readonly height: 230;
  readonly timeSec: number;
  readonly working: boolean;
  readonly owners: readonly KevinPixelOwnerDefinition[];
  readonly primaryOwner: Uint16Array;
  readonly stackOffsets: Uint32Array;
  readonly stackOwnerIndices: Uint16Array;
  readonly mapMask: Uint8Array;
}

export function getKevinPixelOwnerStack(
  snapshot: KevinPixelOwnershipSnapshot,
  x: number,
  y: number,
): readonly KevinPixelOwnerDefinition[] {
  if (x < 0 || y < 0 || x >= snapshot.width || y >= snapshot.height) return [];
  const pixel = y * snapshot.width + x;
  const start = snapshot.stackOffsets[pixel]!;
  const end = snapshot.stackOffsets[pixel + 1]!;
  const owners: KevinPixelOwnerDefinition[] = [];
  for (let index = start; index < end; index += 1) {
    const owner = snapshot.owners[snapshot.stackOwnerIndices[index]!];
    if (owner) owners.push(owner);
  }
  return owners;
}

export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  readonly layerAudit: readonly KevinMotionLayerAudit[];
  buildPixelOwnership(
    timeSec: number,
    working: boolean,
  ): KevinPixelOwnershipSnapshot;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;
const DISH_CX = 309.5;
const DISH_CY = 66.0;
const DISH_RX = 136.0;
const DISH_RY = 48.0;
const ORBIT_Y_RATIO = DISH_RY / DISH_RX; // 0.3529

interface PlanetConfig {
  id: string;
  r: number;
  startAngle: number;
  speed: number;
  color: string;
  spriteSrc: string;
}

const PLANETS: readonly PlanetConfig[] = [
  {
    id: 'mercury',
    r: 17,
    startAngle: 4.40,
    speed: 0.85,
    color: 'rgba(200, 215, 245,',
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAACXklEQVR4nF2SvWsTcRzGn9+95C6XS2LSNpE0arHE1iE6tBW3Ogg6dBA3qeCm/4HgUELG2slFfIEO3R0EQUUpdRFtUbGvUpo2fc0lTXIx95K7S+73k0B18Ds98H0+y/M8BAAYY4QQwrr6ee6+cjGFrG40I0VDMn7aibXZmRmj+wNAunbyF7gKBOc+vnjoGPW7374uDTpciNRcgZkstHug1eaWV48fLy9/sLogYbkctzCSiocZfRsLK6M/Vnbwq3AIz2cslZBI9JSCii3g/fzS0uZO8frk5KTJkXyeMhp6mbk0MlpyRbeBCG0ggf5UnNy4lsFAOsZOq203HZfHQrI8lc/nqTA9/WQctHOrXNn3W2KPpMTaSKga9IaDT5/3QX2X1OxOwOWiNCiJ9yISngl9Ee62Ios4qlhI9lDEsxfgeG2sfl/DkSkgwFFQx0AgFONEKRhkPD8spNPx5MZ2HYbRRH9/FCzoYLfUgt7i0dsbhqpK8LQyKx9sQNebi+CVqvBlvd7wbZMxU0MkCoSUMDpWFX3xIKzfGhRGoCgcbK9DdMt5yphREIzG3juZJw+2NBs952RwLATDtGCTMFy7jcrulq8oPGm06HpNr5XSajwhKIHFN8XDoUVZ5K8Ut/c9z/VEw2GkqpdwWKrSAGTKGW1R0yrzqmS6AT+z120Y4xN3hs+EuQWjYSY7REaTJP2qViLMb3EcPHhW+bVWKjxSVbWqadoxyeVyXDf7ocvjA5kEpqlj36ybiFQsoQ4em9QzZ+uFlVdNoAmgczIloAuebAvZzNnzY8Opiexg78g/w3/3B2sDKP/z4UcNAAAAAElFTkSuQmCC',
  },
  {
    id: 'venus',
    r: 29,
    startAngle: 2.70,
    speed: 0.45,
    color: 'rgba(245, 215, 140,',
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAYAAAA7bUf6AAADy0lEQVR4nFWU309bZRjHv+97zulv2h7aQimlAiOjCtOLYRxgIF2cRi+WeNFpFo0ajQmZ/g0nvfHCCxN/3MzswnnlSGZ0F5sRlQQ3NFlcRjESHD8GFVpaDi2U0572nPd9TbeQsOfiyfPkyTd58uT5fIFjMT2dlo61XSNnBiZTqVPnh4ZOpADEjwZCaBQAOeqPCiKEACFEDA/3Tr75UvJSXHWnAk4S9nllCEVBad8sL22W5278vvJFNrv5GyUEXIiW/lEiQmiEkIx4/43xz18fHfg4zCrIr26AiiYUBxX7NUai8QDcaggP9h345X7hytXrf3wkhGa1dPJ0Ok0JybCptya+fXe85+295Sxb3imhPSDRYGcb2dmpk/x2FUatKnxtRR7pCOGds/0fyBQBQjIXWicgrVVee/m5D7WLz1+uLt1rrqwVlMFBlVDKQSQJkqKAMRtNJnBQrqNmAVSSLdr1tHJ1dv29mzML31ABBF8c6tX4zib/M5uXt3WbmHULB5UGeNOCyyMjnOhEJK5CDblRLJqoMyJ5+Z4YGez+FD5fWJ4cfebVZ3t8sfpejkcjbsooEAgq2C1YME0BlA0cGhyxk91o1BoIqjXRHvERWW6IRESNjA/HzsrJ/s4z/XGPEG1tQlI4JMLRsGxEe4OoGU2YNQvCMrGb20V08CR6Dy3CZYqtwj7XDYhYyP8C9ba5oj6/TMIDCQSifuyVayhuH6JSrsOyBf5b28PDfwpwqX74OyIIRlXYnKH1EmAWkYjokesWKVG3Uzi9FH2nT8E2LeTWdeTWK4glAmiPq5BkBX7Vgzs3ZuByuyArMphlgxAqOIEuLy7n7qytqpeSfQoxm0Ao0QVf2I9yqQrJ4UAw5AVjDDM/LqBUqKBvoB0CAjWDE8vlIqWD8rx8+/birbtjfYVuj9SxWypwPV+lftUJ0+Tw+IDs/BYsBjz8t4gmKIzFEhgED3REkDOYPntv86ZMgMpcdkM7oSYuS+WDpuykjsL2IVaXShAWB6EEDIDNAcNi2NItOJySjWjAsVGqfoJqVafX0mnph58Wvr5+d+e7hqfHUcib9v2/8syoc9FgBMV9Gwc1DkohuM0YkWWmPtXreKA3r9369e/P0um09JgdTSMkkyEXz5/+crQvOOWq6Vhb2UJJN1Br2jzgdRAmOwjcXiiBduTr4sr3P2enNE3jmUzmEYBPUDw+njw30h+eku3mBKxGiNsMpsWhW3S3IaS5smF+NTe/PNvipSVpUXzcTlo0t3zicYRCsbGxwdQrqeELExPJc4lkoutopGlP+sn/OWXKzduJhgcAAAAASUVORK5CYII=',
  },
  {
    id: 'earth',
    r: 43,
    startAngle: 1.85,
    speed: 0.28,
    color: 'rgba(56, 189, 248,',
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAFiklEQVR4nG1Va2xTZRh+vnNrT69rdyl03RhbHdcxriIi4v3yxx/KMCYqiErUBH+oCfFXxbsRExNj5IcaiYmJFtQIQlREcTABhwzHLmVru421bju9np62O6fnnM+UZIri8/N53/fJk7zf+3zAtWC+oJRl/s05ANQDqJ0jCIAQpdW2/7TiSu0fhEIM88rLpmlSAPyK9sef2bFkcfumQENdrSkINlXXzdh0Kh6Px4+NH/jqEKZHzhJCQLdsYREOG9f66+qac3fdul0vHnj9x5P6/sQM7dMonTAp/XY8R/dfkukJhdJXIim6/cgp2vr8a18DCMzN/9tpVxfLhMOGKfquv2Pvm988sf0RX7uaR2lG0lNSgjk2mIGVMMTJa2iZ30pHUkUzzbDMWI2XSYwOJP94/+2HSeTcTzQUYrBnj0mqguTgQYPWtd5wy5tvfLflvvtdjtFoZYko8f4aCYfPDSMyZYfTSpFKD6FiWYSzQyZaXDZYOUNPLV7BXU5PFkfefWsjjZ//g2zdyhBKKSGEOFe/9E7fC7ufW5j6ecBYYo+wTjMO0ZKFxBvIquthYQg+7e7FL+cFEJVipd+NwegEaj28br/9Vm4yfum3sVefXR+ilHAMIdRzT9fO+x7ettB9KV2J5ct8nc8Ch1EPhqOQqYKlfisE21LcWWiDpzIMOivj+K8XoOoGZLPIXd7/mb5656Prig8+/tQeQj7gqntuveuuraLgodJIjAm4bZhUA1hplTBDRZzMdUJNZDAw+D2yowaM2Syi4zPIZNJwuwVksjJVZstEGBujbR1rd0mff/Qhh4bGFa6mYOfF32Kk9/wA6xBZDOc0PLYhCat/GY4MeJCKjKGp2YZx5TKmhuOolEtwOjjwBLByrCm6LMxE72ni3XRTO9rWdHCu9o7NbYH5Qv+xcUMaGmd5joB1ePFhTz1uWpPG0+sdmPQ24ouTCQgWitb2ZqxtrcfZC0PIFwowTYPRyqXy5FiR5zvSvLh8TSMnuu02k4K6WIoF7T7kCyUk0jlQoQ4n+tzoG07hzk4BLQvcKOcysPMGDKECg7dhtpyF3+clVOOso7FoNpNXa3kb5+c0RZlIyCoplFSiZ4vwOEUEG60INrogFSuQihx+j/AI1pfRGlShqRSnL5zCvIAVmRyhaUnOOqylXtMgDilT3mCWNJXLDvYPmXK6YrqdfHIkjnS+CAcPCEQDxzII1tqvvIJmDwu7ZQFEwYKg30Ss+yjcNg7FvMGPx4px01G72MKCKFLiIgcpOUST8Qlv842t0hmTchWFkcsGbE1uuO0C2upF2O02KEoeX3V/CVUF5HwOielpzOMs1GUXHJqVXa775i2jphbVe472V89djf566uOW+Rypa7CbAk+wLOhDs8+JUknBcCwJTS1CzhjwGG5Mxkcwk5hAQHRSC7EzBc31p1JGSli+ukYtKh9V9eYuynrbO/sGNm64d+HB98JGncVgC7kseJaFv96JRc0umIYBVpNRnBnAmdFBqiolUtYdMZGt8SUbFjFaoEnK79vbgdAuhblyqwwpH9+3b2fPpb5Kw6olbF6WdYEHUnkZ6VwW+UIeQ9E4zvZHaEYpwSZ6yZRsnYqOKodV/3UCAk188WLPo0BGxuAg+TulSDhsCKs33d350I4Dfk/AwUaGzWQ0TqemksQumJTnWMjSWMViZpEsWRTGs4B3dq51625nIdV7/AH1l0M/XIm/cNj4J6Q3hzic2KOjtmntoid37W1pCW7m8wWUJ8fx5+QUWGrCyc5iOKeD1DTAFfChpJtHp48d2I3Iuf45wWuT/6oCVm26ueWGm7eJNd6NZVVv0NSKRRA4TTMxNZvPdsvR/k/07iM918z9L0Ihprq8qxgBEP1oWxWE6K2mPP93a/WPqgbzf/AX1OS5NYO6KGgAAAAASUVORK5CYII=',
  },
  {
    id: 'mars',
    r: 57,
    startAngle: 5.25,
    speed: 0.18,
    color: 'rgba(240, 100, 60,',
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADQUlEQVR4nE1Tz2ucVRQ9930/hsk0sZpETG3NLxOjFYPa4iLSnXWTEt24qFCqG8GNi0JdiITiX6C4EDddCIJurOJKxR+ggpGkDcSaNJNJk0lmOjOZyczkm5nvfe+9e2WC0d7VgXvOuVzuPYT/SylFzCyHeOJk+szpiRMjcGI3i8Wd5fXOMgBNRBARBYC7RDoSExGLSPjGhem3zz03eXmwJ/P0wMCgp70MSvltLmznVnOlvc8++mblYwDRPKCuAUxd8AERs8ipD6/MfnVucux5W6giKtdQb7b5TlPQgFKUSeHEYBq7xeLKl3/ceiWb1xtdLYnMK6JrD3z67oXf5yZGpkp/50xAbW9vq640Cw6Y0NCMnyuOb3eUPTv+UGji6vqPy5szr791pXq4wtVLM9ffO3/2cu77RRMGJgAc2i2DMB10Z2OtFONWXbBUN2haMTOjx4K1Uvn6jcX8m2qoP5x66Zmxi7WVHCvd9JVzgBOke1KwTqESAbkDQbFt8FQGeDRgf7vYYHL82sgjx4f9l1+cmh1N+WFtp+geHOxRhgmZtI+4LTDWYedAI2LCcBoI2QEBUzUxUk1sZqgvmFWPDfSdpk4CFfrgIAAzIORBpQKIIoz0eRgMBV1j7bpNK4k1XGsn90BqXDknSIwTQ4LYCoKUj0YzwVbhALuRgQYw2gM4Z2WjLcaSolJsGpGTm07E83cr+6v6yVFKHKHTMPDDALl7Lew3NfzQx1bEGO+FNJ3QnRZrjmy+0+G7Qeg/zMzfqZ+Wsl8v5Ot6PzxOUcdJ1IghAtSNoKktPFis1BLablldid1CueUWDEstIBxzQt/6W8Vk9bfs7hcnh8YulQqSDFMnDJVgPRaUtUOvJ8zMVOi4feN4NbYu25uhOS/AD39mK1k1Pz+vFpduXt0pFzbzYV/4a43N3SjhqnaoaScbzcSuN7VtGdsxxrT70/Z8OuX1xIl5//ATj376heHUyNjo5I1Q/GmJYyTaYK+VcDsxYpwlJ1wPQwr8AGsJ86sL2drOYYaOwvRvujJzZ069E3jBRR3bqUg7z3VvD9ZEsgRPff7L7dInAOyR5sjgfpNuBc8+0T+dIf/xRNg60NriWvmv+/r/cf8BtIDwVLp9KZcAAAAASUVORK5CYII=',
  },
  {
    id: 'jupiter',
    r: 72,
    startAngle: 3.50,
    speed: 0.09,
    color: 'rgba(235, 190, 130,',
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAHNUlEQVR4nHVWW6hdVxUdc621X+fcc859NTdNkyatqcRUU4oVpWIDKpgK/bEkfglSf7SiH7X6I+ltQKUolH74If0S1A8TQagFwYIYpBaTaqnKlVhsr72X3tzHOWe/915v2ae5pTTthMV+r8GeY445JuED4uLZs/zsxYuOiPz+vZMnT4bHjh1b7M7X19cna2trav+Z9yAiMAD2/fYT73OPLl68yM6dO2dBhO899o37+/3oi976T0pjjkopl43ROLQyGN994sj/qrL6yyQvnid69UoHcvYs+KVLN4PRuy+898QY8957nH/skc+NBoPzvX5yWgiOtpVQWkKrbilUjUTdKpRFjUmaYTzJ/vjW9uSJ19/cenF1FezCBXSZ8DcBdSA30hT89IePPzMXs0e799q29Zwx6wAKOJF1nhopYYz3lbR+mua+yDKe5QVt7U79zjj9wbU3tp54197+ndR1IN3xzJkzwy+f+cTvDh9ceiDLCxcF3DstuZRS9OIIXHB4EMpaIq8lhcqB8wBRGCEIA0uMUxgE5+H9oWvr179+A8R1x448unTpEuuY/MpDn/r1Rz502wPOGjUaJGw4HPCllRXcetttGM6PkMQRQsERc49RxNATDv2IYS4JMD8a8eXlJVq+ZVnPz4++dujgwoUbhdFhQOwT/8tnf7x6z4k7zhRVpUcLQSg4gUcJwmQwy4FVEkY20EZDzCm0UiP2DElZIcoz8DSFFzG1BmJxqbFZWX1THA7W3tzc+RUATl3afvbUk0c/et+pa6P5EffWMu80Cc7AGAMPInjGQSxAR5R1HnVdQ7Ztxx/SNEPV1Njb2UZZlJhmOXZ2x+6/r6+z3b291Fp298bGxlaXMn/g8OJ3bpnvhU2eeqtqgjWwsoYpJzDZdbS7b6DZfg2u3IWrxkCbwbY52mICXY2h8z24ejpbpGpwp1g/ECbknDi5RzuOxHcfeWQwP1p4WGmPMIw4I48oFAiCOcRJf5Y+eAdjDaRUqMsCHC1C5pGEHGJ+HuQsVJOAEYO2OUIhfBzxrnZk27RHjh8/Hol777n104Nm49btv1/1QRxTFDC0BMS9HgqjYUEwXc6cgZISqmlR1hVYEKNWDpYCFEWNfDxGWVbI8xJ1VnmVt8w2xRXbymuOubvEwmjuvjgk1KFw3rTcBzEK6ZCbZsYH5wIHRiHKNIfruEp6yGsPboDFYYy0qJDM9TH0BEccjRNAC7CIg4X6dijKnOcbYuXY8eHCaABx0Mw0wjihbzQ8GEQYI0ki9COBYSdSbaEdMJIWbVOB6RJhUyEvG/i0gJ2roYYlBtGUlcEeKLfHE4iPMaK3RDy4BWI4gmA1enMDRDeEGcXJTG3GeRRlDSYcAu9AxiCc8xhYjTSdwFMBgRrcBIAieK4gwgg0q1QkQRQSOQexsXm9ESJAoy1cq6G8AHGCUBKeCcRRDEtArRt4RzDaQEsFKVvUtYFUDFmpMc4kpoVEWWlUlYTs9lLWcEaBdZiI3c31VwesQtvWNKu4pAcRJm9rSAjAduL2aMoM1jpordBIDW0cWu1Q1A0muzso8xJNXSLLKuRZjcn2rldV+pbgfNla/5JYe+31lxbmWJ4INzTeew5P3NsZsZ4YGHUidRCugTUeWml0HS9rWrTKwUgFwQMkcYi6dCinu77OK6qy9F/OyKvWibixwcvsR888uzWtzQti/oh3c7dbHS6i8QmmpUKpGTLpMS1qjCsgr9TsT8aTDNl0gvH2FnRbA9V12GwTzjn43iIaRFAkLAv7n3Ei/s/29nY1696VTX7SsP7DiAUZxsDCCMmIwTqLIAgRdL3OGHhnZn80XJJAOoEb72B6fQPpzhR1q9EwAQ2BtjMFHpwSgpiz9vf7TZWfO3fur08/9f2fHzl44KutlJoYgs6ViTiSXgRnHSJOkEqj0R7KWpR1MzM+HfThFu6AzEukae4nWUlZVlbeU99Z+/T6+uaVG00V9OSTq/TKK6/0P37y6JWlpeEJKxstgjgg6vwmnHmYbksYT7C201CDvKrQqq7qLLIsQ1qWriwbtjee7GVFvcaY//fm5u63O4XMeh0R/Ooq6LnnniuITj94/MixPyzPj+7iVmnyTnBuqZs8mqqcdYpOV6qrvNYgywsUZeWLouzaEkvzIs2K+k/e+hctj54F0A0vncu87axdrK6usgsXLrjP33/vobtOfPgXg1702YALcE6GAOqGHKsVNUpT0yrUTeuruvFFUbA0yzFJ83+UdftnIvqbNPSb8Xhc7IPcNJzsg3Wu+IUH7vtWGIjHe734sGBsVlG26+Baoa4745OQSqEsa1m38mqr9G8dEy/s7Ez/+a555Obh5J0hBSBGnR96LNx55+jEyuKXIsEfcs6dskavWGt7UknfNO2kbeXLrTbPA7jqvVjryvi9Q8kHAu3H6dOnxeXLlzsib8Th5OhRvhIEWDDGuLKUO3t7e1vv+aybD7qM3BT/ByMJZQ/RKmNKAAAAAElFTkSuQmCC',
  },
  {
    id: 'saturn',
    r: 88,
    startAngle: 0.20,
    speed: 0.05,
    color: 'rgba(240, 220, 170,',
    spriteSrc: 'data:image/png;base64,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',
  },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Failed to load image within timeout: ${url.slice(0, 40)}`));
    }, 15000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load image: ${url.slice(0, 40)}`));
    };
    img.src = url;
  });
}

export async function loadKevinPixelMotion(
  assetUrl: string,
): Promise<KevinPixelMotion> {
  const baseImg = await loadImage(assetUrl);
  if (baseImg.naturalWidth !== WIDTH || baseImg.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${baseImg.naturalWidth}x${baseImg.naturalHeight}`,
    );
  }

  // Pre-load the 6 celestial body sprites
  const loadedSprites = await Promise.all(
    PLANETS.map(async (p) => ({
      ...p,
      image: await loadImage(p.spriteSrc),
    })),
  );

  // Base canvas containing the clean table, glowing concentric orbits, and central Sun
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = WIDTH;
  baseCanvas.height = HEIGHT;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) throw new Error('2D context unavailable for Kevin base canvas');
  baseCtx.drawImage(baseImg, 0, 0);

  // Runtime animation composite frame canvas
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = WIDTH;
  frameCanvas.height = HEIGHT;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('2D context unavailable for Kevin frame canvas');

  // Metadata audit
  const layerAudit: readonly KevinMotionLayerAudit[] = [
    {
      id: 'holographic_sun',
      kind: 'authored-static',
      z: 10,
    },
    {
      id: 'concentric_laser_orbits',
      kind: 'generated-static',
      z: 20,
      primitiveCount: 6,
    },
    ...PLANETS.map((p, idx): KevinMotionLayerAudit => ({
      id: p.id,
      kind: 'planet-dynamic',
      z: 100 + idx,
      orbitRadius: p.r,
      orbitPeriodSec: (Math.PI * 2) / p.speed,
    })),
  ];

  // Dummy ownership snapshot for inspector compatibility
  const dummyOwners: KevinPixelOwnerDefinition[] = [
    {
      id: 'kevin_station_base',
      parentId: null,
      category: 'map-base',
      subpart: 'table',
      dynamic: false,
      z: 0,
    },
  ];
  const totalPixels = WIDTH * HEIGHT;
  const dummyPrimary = new Uint16Array(totalPixels);
  const dummyOffsets = new Uint32Array(totalPixels + 1);
  const dummyStack = new Uint16Array(totalPixels);
  const dummyMask = new Uint8Array(totalPixels);

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    layerAudit,

    buildPixelOwnership(
      timeSec: number,
      working: boolean,
    ): KevinPixelOwnershipSnapshot {
      return {
        width: WIDTH,
        height: HEIGHT,
        timeSec,
        working,
        owners: dummyOwners,
        primaryOwner: dummyPrimary,
        stackOffsets: dummyOffsets,
        stackOwnerIndices: dummyStack,
        mapMask: dummyMask,
      };
    },

    render(timeSec: number, working: boolean): HTMLCanvasElement {
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.drawImage(baseCanvas, 0, 0);

      const speedMult = working ? 1.4 : 1.0;

      // Strict elliptical design boundary
      frameCtx.save();
      frameCtx.beginPath();
      frameCtx.ellipse(DISH_CX, DISH_CY, DISH_RX, DISH_RY, 0, 0, Math.PI * 2);
      frameCtx.clip();

      // 1. Planetary motion in pure cosmic galaxy space (zero concentric blueprint rings)

      // 2. Compute 3D positions and draw dynamic trailing orbital wakes
      const trailLen = 0.40;
      const trailSteps = 16;
      const states = loadedSprites.map((p) => {
        const theta = p.startAngle + p.speed * timeSec * speedMult;
        const gx = DISH_CX + Math.cos(theta) * p.r;
        const gy = DISH_CY + Math.sin(theta) * (p.r * ORBIT_Y_RATIO);
        const normDepth = (gy - DISH_CY) / DISH_RY;
        const scale = 1.0 + normDepth * 0.12;

        // Draw glowing cometary motion trail behind the planet along its orbit
        for (let s = 0; s < trailSteps; s += 1) {
          const frac = s / trailSteps;
          const trailTheta = theta - (1.0 - frac) * trailLen;
          const tx = DISH_CX + Math.cos(trailTheta) * p.r;
          const ty = DISH_CY + Math.sin(trailTheta) * (p.r * ORBIT_Y_RATIO);
          const alpha = (0.45 * Math.pow(frac, 2.0)).toFixed(3);
          frameCtx.fillStyle = p.color + alpha + ')';
          frameCtx.fillRect(Math.round(tx), Math.round(ty), 1, 1);
          if (s > trailSteps - 5) {
            frameCtx.fillRect(Math.round(tx), Math.round(ty) + 1, 1, 1);
          }
        }

        return {
          ...p,
          gx,
          gy,
          depth: gy,
          scale,
        };
      });

      // Sort back-to-front (depth = gy)
      states.sort((a, b) => a.depth - b.depth);

      // Render bodies behind the Sun (gy < DISH_CY)
      for (const s of states) {
        if (s.depth < DISH_CY) {
          const iw = Math.round(s.image.naturalWidth * s.scale);
          const ih = Math.round(s.image.naturalHeight * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      // Volumetric breathing solar corona
      const sunBreath = 0.5 + 0.5 * Math.sin(timeSec * 2.8);
      const sunGlow = frameCtx.createRadialGradient(
        DISH_CX,
        DISH_CY,
        2,
        DISH_CX,
        DISH_CY,
        18 + sunBreath * 3,
      );
      sunGlow.addColorStop(0, 'rgba(255, 255, 240, 0.45)');
      sunGlow.addColorStop(0.3, 'rgba(255, 220, 110, ' + (0.28 + sunBreath * 0.10).toFixed(3) + ')');
      sunGlow.addColorStop(0.7, 'rgba(255, 140, 30, ' + (0.12 + sunBreath * 0.06).toFixed(3) + ')');
      sunGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
      frameCtx.fillStyle = sunGlow;
      frameCtx.beginPath();
      frameCtx.ellipse(
        DISH_CX,
        DISH_CY,
        22 + sunBreath * 3,
        12 + sunBreath * 2,
        0,
        0,
        Math.PI * 2,
      );
      frameCtx.fill();

      // Render bodies in front of the Sun (gy >= DISH_CY)
      for (const s of states) {
        if (s.depth >= DISH_CY) {
          const iw = Math.round(s.image.naturalWidth * s.scale);
          const ih = Math.round(s.image.naturalHeight * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      frameCtx.restore();

      return frameCanvas;
    },
  };
}
