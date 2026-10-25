"""Render diagnostic contact sheets from the image and recorded detections."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parents[1]
image = Image.open(ROOT / 'dist/assets/plano.jpeg').convert('RGB')
cases = json.loads((ROOT / 'reports/openings-inspection.json').read_text(encoding='utf-8'))
prediction = json.loads((ROOT / 'dist/data/plano-prediction.json').read_text(encoding='utf-8'))
font_path = 'C:/Windows/Fonts/arial.ttf' if Path('C:/Windows/Fonts/arial.ttf').exists() else 'DejaVuSans.ttf'
font = ImageFont.truetype(font_path, 15)
small = ImageFont.truetype(font_path, 12)
out = ROOT / 'docs/images/openings-audit'
out.mkdir(parents=True, exist_ok=True)
for page in range((len(cases) + 5) // 6):
    board = Image.new('RGB', (1350, 900), '#f5f6f1')
    draw = ImageDraw.Draw(board)
    for index, case in enumerate(cases[page*6:page*6+6]):
        x, y = (index % 3)*450, (index // 3)*450
        box = case['bbox']
        cx, cy = (box[0]+box[2])/2, (box[1]+box[3])/2
        extent = max(150, box[2]-box[0]+90, box[3]-box[1]+90)
        left, top = max(0, min(image.width-extent, cx-extent/2)), max(0, min(image.height-extent, cy-extent/2))
        crop = image.crop((round(left), round(top), round(left+extent), round(top+extent))).resize((420, 360))
        board.paste(crop, (x+15, y+60))
        sx, sy = 420/extent, 360/extent
        def mapped(bounds):
            return [x+15+(bounds[0]-left)*sx, y+60+(bounds[1]-top)*sy,
                    x+15+(bounds[2]-left)*sx, y+60+(bounds[3]-top)*sy]
        # Show other proposals as thin blue contours to expose fragments/duplicates.
        for other in prediction['objects']:
            b = other['bbox']
            if other['category'] in ['door', 'window'] and other['confidence'] >= .35 and left<=b[0] and b[2]<=left+extent and top<=b[1] and b[3]<=top+extent:
                draw.rectangle(mapped(b), outline='#6585b0', width=1)
                draw.text((mapped(b)[0], mapped(b)[1]-12), other['id'].replace('semantic-', ''), font=small, fill='#38577e')
        nearest = case['nearest'][0]
        if nearest['iou'] > 0:
            draw.rectangle(mapped(nearest['bbox']), outline='#168957', width=2)
        draw.rectangle(mapped(box), outline='#d45c20', width=3)
        draw.text((x+15, y+10), f"{case['id']}  {case['category']}  score {case['confidence']:.2f}", font=font, fill='#273d34')
        draw.text((x+15, y+32), f"{nearest['id']}  IoU {nearest['iou']:.2f} | naranja: propuesta; verde: referencia", font=small, fill='#52645a')
    board.save(out / f'pendientes-{page+1}.png')
print(out)
report = json.loads((ROOT / 'dist/data/openings-audit.json').read_text(encoding='utf-8'))
for page in range((len(report['cases']) + 5) // 6):
    board = Image.new('RGB', (1350, 900), '#f5f6f1')
    draw = ImageDraw.Draw(board)
    for index, case in enumerate(report['cases'][page*6:page*6+6]):
        x, y = (index % 3)*450, (index // 3)*450
        boxes = [case['bbox'], case['referenceBbox']]
        if case['opening']:
            boxes.append(case['opening']['bbox'])
        cx = (min(b[0] for b in boxes) + max(b[2] for b in boxes))/2
        cy = (min(b[1] for b in boxes) + max(b[3] for b in boxes))/2
        extent = max(150, max(b[2] for b in boxes)-min(b[0] for b in boxes)+80,
                     max(b[3] for b in boxes)-min(b[1] for b in boxes)+80)
        left = max(0, min(image.width-extent, cx-extent/2))
        top = max(0, min(image.height-extent, cy-extent/2))
        board.paste(image.crop((round(left), round(top), round(left+extent), round(top+extent))).resize((420,360)),(x+15,y+60))
        def rect(b, color, line_width):
            bounds = [x+15+(b[0]-left)*420/extent, y+60+(b[1]-top)*360/extent,
                      x+15+(b[2]-left)*420/extent, y+60+(b[3]-top)*360/extent]
            draw.rectangle(bounds, outline=color, width=line_width)
        rect(case['referenceBbox'], '#567bac', 2)
        rect(case['bbox'], '#cf8734', 2)
        if case['opening']:
            rect(case['opening']['bbox'], '#1d8061', 3)
        draw.text((x+15,y+8), case['objectId']+' | '+('GEOMETRÍA EN REVISIÓN' if case['geometryReview'] else 'ASOCIACIÓN RECUPERADA'), font=font, fill='#273d34')
        draw.text((x+15,y+32), 'Naranja: propuesta | Verde: reconstrucción | Azul: referencia', font=small, fill='#52645a')
    board.save(out / f'resultado-{page+1}.png')
