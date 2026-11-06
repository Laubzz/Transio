# Bande-son synthétisée (120 BPM, 60 s) calée sur les coupes de la vidéo.
import numpy as np, wave

SR, DUR, BPM = 48000, 60.0, 120
BEAT = 60 / BPM
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
CUTS = [6, 14, 21, 28.5, 37, 45, 51.5, 56.5]

def hz(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - pan) / 1.0
    R[i:i + len(sig)] += sig * gain * (1 + pan) / 1.0

def tone(f, dur, harm=6, det=0.0):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * k * (1 + det) * t) / k ** 1.4 for k in range(1, harm + 1))
    return s

# Accords : Am – F – C – G (4 s chacun)
CH = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
for k in range(15):
    t0 = k * 4; ch = CH[k % 4]; d = 4.6
    env_t = np.arange(int(d * SR)) / SR
    env = np.minimum(env_t / 0.6, 1) * np.clip((d - env_t) / 0.8, 0, 1)
    for j, m in enumerate(ch):
        for det, pan in ((-0.003, -0.5), (0.003, 0.5)):
            add(tone(hz(m), d, 5, det) * env, t0, 0.035, pan)
    # basse
    if t0 >= 6:
        for b in range(8):
            bt = t0 + b * BEAT
            dd = 0.45; tt = np.arange(int(dd * SR)) / SR
            add(np.sin(2 * np.pi * hz(ch[0] - 12) * tt) * np.exp(-tt * 6), bt + BEAT / 2, 0.16)

# Arpège léger (à partir de 21 s)
for k in range(int(21 / (BEAT / 2)), int(56.5 / (BEAT / 2))):
    t0 = k * BEAT / 2; ch = CH[int(t0 // 4) % 4]
    m = ch[k % 3] + 12; dd = 0.3; tt = np.arange(int(dd * SR)) / SR
    add(np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 12), t0, 0.05, 0.4 if k % 2 else -0.4)

def kick():
    tt = np.arange(int(0.35 * SR)) / SR
    f = 45 + 110 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
def hat():
    n = rng.standard_normal(int(0.06 * SR)); n = np.diff(n, prepend=0)
    return n * np.exp(-np.arange(len(n)) / SR * 70)
def clap():
    n = rng.standard_normal(int(0.2 * SR)); n = n - np.convolve(n, np.ones(8) / 8, 'same')
    return n * np.exp(-np.arange(len(n)) / SR * 22)

K, Hh, Cl = kick(), hat(), clap()
t = 6.0
while t < 56.5:
    add(K, t, 0.55)
    if t >= 14: add(Hh, t + BEAT / 2, 0.06, 0.3)
    if t >= 21 and int(round(t / BEAT)) % 2 == 1: add(Cl, t, 0.09, -0.1)
    t += BEAT
# coup final
add(K, 56.5, 0.7)
tt = np.arange(int(3.5 * SR)) / SR
for m in (57, 64, 69, 72):
    add(tone(hz(m), 3.5, 4) * np.exp(-tt * 1.1), 56.5, 0.05)

# Montée avant 6 s et souffles aux coupes
def whoosh(d, rise=True):
    n = rng.standard_normal(int(d * SR)); n = np.convolve(n, np.ones(24) / 24, 'same')
    e = np.linspace(0, 1, len(n)) ** 2 if rise else np.sin(np.linspace(0, np.pi, len(n)))
    return n * e
add(whoosh(2.5), 3.5, 0.5)
for c in CUTS:
    add(whoosh(0.8, False), c - 0.4, 0.35)

mix = np.stack([L, R], 1)
tt = np.arange(N) / SR
mix *= (np.minimum(tt / 1.0, 1) * np.clip((DUR - tt) / 1.2, 0, 1))[:, None]
mix = np.tanh(mix * 1.4)
mix /= np.abs(mix).max() / 0.89
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('music.wav ok')
