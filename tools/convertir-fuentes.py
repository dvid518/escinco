#!/usr/bin/env python
"""Convierte las TTF autoalojadas de escinco a WOFF2 y las deja en base64.

El prototipo es un unico archivo HTML que debe abrirse con file://, asi que
las fuentes viajan como data URI. WOFF2 + base64 ocupa mucho menos que la TTF
original sin cambiar ni un pixel del renderizado.
"""
import base64
import pathlib
import sys

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "fonts"
DESTINO = RAIZ / "tools" / "fuentes-base64.txt"

# El prototipo solo usa estos 8 cortes: sin italicas.
CORTES = [
    ("Inter", "Inter/Inter_18pt-Regular.ttf", "normal", 400),
    ("Inter", "Inter/Inter_18pt-Medium.ttf", "normal", 500),
    ("Inter", "Inter/Inter_18pt-SemiBold.ttf", "normal", 600),
    ("Inter", "Inter/Inter_18pt-Bold.ttf", "normal", 700),
    ("Roboto Mono", "Roboto_Mono/RobotoMono-Regular.ttf", "normal", 400),
    ("Roboto Mono", "Roboto_Mono/RobotoMono-Medium.ttf", "normal", 500),
    ("Roboto Mono", "Roboto_Mono/RobotoMono-SemiBold.ttf", "normal", 600),
    ("Roboto Mono", "Roboto_Mono/RobotoMono-Bold.ttf", "normal", 700),
]


def convertir(origen: pathlib.Path) -> bytes:
    fuente = TTFont(str(origen))
    buffer = pathlib.Path(str(origen) + ".woff2")
    fuente.flavor = "woff2"
    fuente.save(str(buffer))
    datos = buffer.read_bytes()
    buffer.unlink()
    return datos


def principal():
    lineas = []
    total_fuente = total_b64 = 0
    for familia, archivo, estilo, peso in CORTES:
        origen = FUENTES / archivo
        if not origen.exists():
            print(f"FALTA {archivo}", file=sys.stderr)
            return 1
        woff2 = convertir(origen)
        b64 = base64.b64encode(woff2).decode("ascii")
        total_fuente += origen.stat().st_size
        total_b64 += len(b64)
        lineas.append(
            f"{familia}|{estilo}|{peso}|data:font/woff2;base64,{b64}"
        )
        print(
            f"{familia:12} {peso}  {archivo:28} "
            f"{origen.stat().st_size / 1024:7.1f} KB -> {len(woff2) / 1024:6.1f} KB "
            f"-> base64 {len(b64) / 1024:7.1f} KB"
        )
    DESTINO.parent.mkdir(exist_ok=True)
    DESTINO.write_text("\n".join(lineas), encoding="utf-8")
    print(
        f"\nTotal TTF {total_fuente / 1024 / 1024:.2f} MB -> "
        f"base64 {total_b64 / 1024 / 1024:.2f} MB "
        f"escrito en {DESTINO.relative_to(RAIZ)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())