"""
Misst, ob der Bake-Rand des Farbatlas Inseln anderer Teile übermalt (CHAOS-234).

    .venv-blender/bin/python packages/assets/blender/atlas_rand.py sock [--raender=16,8,4,2] [--abstand=0.008] [--bild=<ordner>]

Blender backt Teil für Teil und füllt danach den Rand (`EXTEND`) um die Inseln dieses Teils, auch
über Pixel, die ein vorher gebackenes Teil schon gefüllt hat (CHAOS-221). Das Skript wickelt die
Figur einmal ab (`figurkit.prepare_atlas`, wie im Export) und backt dann auf derselben Abwicklung:

1. mit Rand 0 in eine Textur mit Alpha: Alpha > 0 sind die Pixel innerhalb der Inseln (Abdeckung),
   die Farben dort sind die Sollwerte;
2. noch einmal mit Rand 0 als Gegenprobe (muss 0 Abweichungen ergeben);
3. mit jedem Rand aus `--raender`.

Gezählt werden je Rand die Pixel innerhalb der Inseln, die vom Sollwert abweichen (größte
Kanaldifferenz > 1/255), und davon die deutlichen (> 0,1, also eine andere Farbe, kein Rundungsrest).
Mit `--bild` entsteht je Rand eine PNG: Atlas grau, abweichende Pixel rot.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import figurkit as k  # noqa: E402
import struktur  # noqa: E402

FIGURES = ("robot", "cactus", "raccoon", "sock")
SPUR = 1 / 255
DEUTLICH = 0.1


def _pixels(image: bpy.types.Image) -> np.ndarray:
    size = image.size[0]
    out = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(out)
    return out.reshape(size, size, 4)


def _bake(materials: list[bpy.types.Material], name: str, size: int, margin: int) -> np.ndarray:
    image = bpy.data.images.new(name, size, size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.generated_color = (0.0, 0.0, 0.0, 0.0)
    k.bake_atlas(materials, image, margin)
    return _pixels(image)


def _save(path: Path, base: np.ndarray, cover: np.ndarray, wrong: np.ndarray) -> None:
    size = base.shape[0]
    grey = base[..., :3].mean(axis=2, keepdims=True) * 0.6 + 0.2
    rgb = np.where(cover[..., None], np.repeat(grey, 3, axis=2), 0.05)
    rgb[wrong] = (1.0, 0.0, 0.0)
    out = np.concatenate([rgb, np.ones((size, size, 1), dtype=np.float32)], axis=2)
    image = bpy.data.images.new(path.stem, size, size, alpha=False)
    image.pixels.foreach_set(out.astype(np.float32).ravel())
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()


def measure(figure: str, margins: list[int], island_margin: float, picture_dir: Path | None) -> None:
    importlib.import_module(figure).build()  # setzt die Szene selbst zurück
    struktur.apply()  # wie im Export: die Struktur-Map entsteht vor dem Atlas
    prepared = k.prepare_atlas(f"{figure}_mess", island_margin=island_margin, alpha=True)
    assert prepared is not None, f"{figure}: keine Teile mit Vertexfarben"
    _, materials = prepared
    size = k.ATLAS_SIZE

    soll = _bake(materials, "soll", size, 0)
    cover = soll[..., 3] > 0.5
    gegenprobe = _bake(materials, "gegenprobe", size, 0)
    noise = int((np.abs(gegenprobe - soll)[cover][:, :3].max(axis=1) > SPUR).sum())
    print(
        f"Atlas {figure}: {size}², Inselabstand {island_margin} (≈ {island_margin * size:.1f} px), "
        f"Abdeckung {cover.sum()} px ({cover.mean():.1%}), Gegenprobe Rand 0: {noise} px"
    )
    for margin in margins:
        test = _bake(materials, f"rand{margin}", size, margin)
        diff = np.abs(test - soll)[..., :3].max(axis=2)
        wrong = cover & (diff > SPUR)
        clear = cover & (diff > DEUTLICH)
        print(
            f"  Rand {margin:>2} px: {int(wrong.sum()):>6} px abweichend "
            f"({wrong.sum() / cover.sum():.2%} der Inseln), davon deutlich {int(clear.sum())} px"
        )
        if picture_dir is not None:
            picture_dir.mkdir(parents=True, exist_ok=True)
            _save(picture_dir / f"atlas-rand-{figure}-{margin}.png", soll, cover, wrong)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    figures = list(FIGURES) if args == ["all"] else args
    if not figures or any(f not in FIGURES for f in figures):
        print(f"Aufruf: atlas_rand.py <{'|'.join(FIGURES)}|all> [--raender=16,4,2] [--abstand=0.008] [--bild=<ordner>]")
        raise SystemExit(1)
    margins = [int(m) for m in opts.get("raender", "16,8,4,2").split(",")]
    island_margin = float(opts.get("abstand", str(k.ATLAS_ISLAND_MARGIN)))
    picture_dir = Path(opts["bild"]).resolve() if "bild" in opts else None
    for figure in figures:
        measure(figure, margins, island_margin, picture_dir)


if __name__ == "__main__":
    main()
