import fitz,re,json,unicodedata
from pathlib import Path
pdf=fitz.open('/workspace/scratch/3115bb54f3d4/upload/MENÚ IMPRESIÓN.pdf')
products=[]
for page in pdf:
 text=unicodedata.normalize('NFKC',page.get_text())
 text=text.replace('Tarta de Pera y Queso Brie en Salsa de \nZarzamoras','Tarta de Pera y Queso Brie en Salsa de Zarzamoras')
 text=text.split('EXTRAS')[0]
 matches=list(re.finditer(r'^([^\n]+?)\s*\.{2,}\s*\$(\d+)',text,re.M))
 for i,m in enumerate(matches):
  name=m.group(1).strip(); desc=text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip()
  desc=re.split(r'\n(?:PIZZAS ITALIANAS|POSTRES)',desc)[0]
  n=len(products)
  cat=('Entradas y ensaladas' if n<6 else 'Pastas') if page.number==0 else ('Pizzas clásicas' if i<4 else 'Pizzas italianas' if i<18 else 'Postres')
  products.append(dict(id=f'p{n+1:02}',name=name,description=' '.join(desc.split()),price=int(m.group(2)),category=cat,image=None))
for name,price,desc in [('La Mafia',290,'Crema, jamón, mozzarella, alcachofa, champiñón, queso de cabra, queso parmesano, aceite de ajo y albahaca.'),('Capo di Tutti',290,'Salsa arrabbiata, mozzarella fresca, espinaca salteada, pepperoni, queso de cabra, parmesano y aceite de ajo.'),('Ricotta',300,'Queso ricotta, queso mozzarella, parmesano, aceite de ajo y salsa marinara.'),('Piatto della Vita',330,'Salsa pesto, mozzarella, cherrys, pancetta; calzone de pasta carbonara con queso mozzarella. 3 en 1.')]:
 products.append(dict(id=f'p{len(products)+1:02}',name=name,price=price,description=desc,category='Calzones',image=None))
products[2]['image']='assets/menu-0-0.jpeg'
Path('dist/catalog.json').write_text(json.dumps(products,ensure_ascii=False,indent=2))
print('Productos:',len(products))
from collections import Counter
print(Counter(p['category'] for p in products))
