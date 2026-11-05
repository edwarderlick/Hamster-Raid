from PIL import Image, ImageDraw, ImageFont

im = Image.open(r"d:\Hamster Raid\public\art\kenney-town.png").convert("RGBA")
print("packed", im.size)
tw, th = 16, 16
cols, rows = 12, 11
scale = 4
out = Image.new(
    "RGBA",
    (cols * tw * scale + (cols + 1) * 4, rows * th * scale + (rows + 1) * 18),
    (20, 24, 40, 255),
)
draw = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype("arial.ttf", 12)
except Exception:
    font = ImageFont.load_default()
i = 0
for r in range(rows):
    for c in range(cols):
        tile = im.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th))
        tile = tile.resize((tw * scale, th * scale), Image.NEAREST)
        x = 4 + c * (tw * scale + 4)
        y = 16 + r * (th * scale + 18)
        out.paste(tile, (x, y))
        draw.text((x, y - 14), str(i), fill=(255, 220, 80), font=font)
        i += 1
out.save(r"d:\Hamster Raid\qa-screens\kenney-index.png")
print("wrote kenney-index", out.size, "tiles", i)
