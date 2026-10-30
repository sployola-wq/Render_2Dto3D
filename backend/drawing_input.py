"""Drawing preprocessing with explicit source coordinates, never a generated plan."""
import io
import cv2
import numpy as np
from PIL import Image, ImageOps


def read_drawing(payload):
    source = Image.open(io.BytesIO(payload))
    if source.width * source.height > 25_000_000:
        raise ValueError('La imagen excede 25 millones de píxeles.')
    source = ImageOps.exif_transpose(source).convert('RGBA')
    paper = Image.new('RGBA', source.size, 'white')
    paper.alpha_composite(source)
    return paper.convert('RGB')


def normalize_drawing(image):
    """Only invert dark paper. Preserve locations and colored CAD annotations."""
    gray = np.asarray(image.convert('L'))
    border = np.concatenate([gray[0], gray[-1], gray[:, 0], gray[:, -1]])
    # Letterbox bars alone do not make a dark blueprint.
    dark = float(np.median(border)) < 90 and float((gray < 100).mean()) > .55
    return (ImageOps.invert(image) if dark else image), {'darkPaperInverted': dark}


def content_bounds(image):
    """Ignore isolated scan dirt, paper frames and letterbox bars, not side views."""
    factor = min(1, 1000 / max(image.size))
    gray = np.asarray(image.resize((max(1, round(image.width * factor)), max(1, round(image.height * factor)))).convert('L'))
    h, w = gray.shape
    low, high = np.percentile(gray, [10, 90])
    if high - float(gray.min()) < 12:
        return (0, 0, image.width, image.height)
    ink = (gray < min(220, high - max(18, (high-low)*.25))).astype(np.uint8)
    ink[:, ink.mean(0) > .88] = 0
    ink[ink.mean(1) > .88, :] = 0
    count, ids, stats, _ = cv2.connectedComponentsWithStats(ink)
    regions = []
    for x, y, rw, rh, area in stats[1:]:
        if area < max(8, w*h*.000025):
            continue
        if rw > w*.96 or rh > h*.96:
            continue
        regions.append((x, y, x+rw, y+rh))
    if not regions:
        return (0, 0, image.width, image.height)
    bounds = np.asarray(regions)
    pad = max(8, round(min(w, h)*.025))
    return (max(0, int((bounds[:, 0].min()-pad)/factor)),
            max(0, int((bounds[:, 1].min()-pad)/factor)),
            min(image.width, int((bounds[:, 2].max()+pad)/factor)),
            min(image.height, int((bounds[:, 3].max()+pad)/factor)))


def classification_views(image):
    normalized, details = normalize_drawing(image)
    bounds = content_bounds(normalized)
    crop = normalized.crop(bounds)
    views = [view.rotate(angle, expand=True, fillcolor='white') for angle in (0, 90, 180, 270) for view in (normalized, crop)]
    def fit(view):
        fitted = ImageOps.contain(view, (224, 224), Image.Resampling.LANCZOS)
        square = Image.new('RGB', (224, 224), 'white')
        square.paste(fitted, ((224-fitted.width)//2, (224-fitted.height)//2))
        return square
    return [fit(view) for view in views], {**details, 'contentBounds': list(bounds), 'views': 8}
