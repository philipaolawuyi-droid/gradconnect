"""Create GradConnect native and PWA launcher assets from approved artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/home/ubuntu/webdev-static-assets/gradconnect-native-icon.png")
IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
PWA_PUBLIC = Path("/home/ubuntu/webdev-static-assets/gradconnect-pwa")
PWA_ICON_SIZES = {
    "icon-96.png": 96,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-icon.png": 180,
}
ANDROID_ICON_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def resize_icon(size: int) -> Image.Image:
    with Image.open(SOURCE) as artwork:
        resized = artwork.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), "#050505")
        canvas.alpha_composite(resized)
        return canvas


def maskable_icon(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), "#050505")
    safe_size = round(size * 0.72)
    artwork = resize_icon(safe_size)
    offset = (size - safe_size) // 2
    canvas.alpha_composite(artwork, (offset, offset))
    return canvas


def save_png(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "PNG", optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing approved GradConnect icon source: {SOURCE}")

    save_png(resize_icon(1024), IOS_ICON)

    for filename, size in PWA_ICON_SIZES.items():
        save_png(resize_icon(size), PWA_PUBLIC / filename)
    save_png(maskable_icon(192), PWA_PUBLIC / "icon-maskable-192.png")
    save_png(maskable_icon(512), PWA_PUBLIC / "icon-maskable-512.png")

    for directory, size in ANDROID_ICON_SIZES.items():
        icon = resize_icon(size)
        target = ROOT / "android/app/src/main/res" / directory
        save_png(icon, target / "ic_launcher.png")
        save_png(icon, target / "ic_launcher_round.png")
        save_png(icon, target / "ic_launcher_foreground.png")


if __name__ == "__main__":
    main()
