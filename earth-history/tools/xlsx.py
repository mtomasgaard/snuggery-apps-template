"""A minimal .xlsx reader: zipfile + ElementTree, no third-party package (RESEARCH.md §1, Python).

Reads cell values exactly as stored: numbers as float, shared and inline strings as str, booleans as
bool, formulas by their cached value. Dates are not converted (none of the pinned sheets has any).
Cells are addressed by (row, column), both 1-based, as the sheet names them ("AI5" -> (5, 35)).
"""
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'}
_REF = re.compile(r'^([A-Z]+)([0-9]+)$')


def col_index(letters):
    """'A' -> 1, 'Z' -> 26, 'AA' -> 27, 'AI' -> 35."""
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n


def _text(el):
    return ''.join(t.text or '' for t in el.iter('{%s}t' % NS['m']))


def read_workbook(path):
    """{sheet name: {(row, col): value}} for every sheet, in workbook order (a dict keeps it)."""
    out = {}
    with zipfile.ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared = [_text(si) for si in root.findall('m:si', NS)]
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = {r.get('Id'): r.get('Target') for r in rels.findall('rel:Relationship', NS)}
        for sh in wb.find('m:sheets', NS).findall('m:sheet', NS):
            rid = sh.get('{%s}id' % NS['r'])
            t = target[rid].lstrip('/')
            part = t if t.startswith('xl/') else 'xl/' + t
            root = ET.fromstring(z.read(part))
            cells = {}
            for c in root.iter('{%s}c' % NS['m']):
                m = _REF.match(c.get('r'))
                key = (int(m.group(2)), col_index(m.group(1)))
                typ = c.get('t')
                v = c.find('m:v', NS)
                if typ == 's':
                    val = shared[int(v.text)]
                elif typ == 'inlineStr':
                    val = _text(c.find('m:is', NS))
                elif typ == 'str':
                    val = v.text if v is not None else None
                elif typ == 'b':
                    val = v is not None and v.text == '1'
                elif typ == 'e':
                    val = None
                else:
                    val = float(v.text) if v is not None and v.text not in (None, '') else None
                if val is not None:
                    cells[key] = val
            out[sh.get('name')] = cells
    return out
