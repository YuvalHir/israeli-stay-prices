import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
// Verify the table rebuild on a database with existing reports and votes.
const result = execFileSync('python3', ['-c', `
import sqlite3, pathlib
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
for p in sorted(pathlib.Path('migrations').glob('*.sql')):
 if p.name.startswith('0013'): break
 c.executescript(p.read_text())
c.execute("INSERT INTO users(id,email) VALUES('u','u@example.com')")
c.execute("INSERT INTO reports(id,user_id,place_id,place_name,price,currency,room,stay_month) VALUES('r','u','p','P',100,'NPR','private','2026-09')")
c.execute("INSERT INTO report_votes(report_id,user_id,vote) VALUES('r','u',1)");c.commit()
c.executescript(pathlib.Path('migrations/0013_room_beds_israeli_deal.sql').read_text())
assert c.execute('SELECT count(*) FROM report_votes').fetchone()[0]==1
assert c.execute('SELECT price, beds, israeli_deal FROM reports WHERE id="r"').fetchone()==(100,None,0)
assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
c.execute("INSERT INTO reports(id,user_id,place_id,place_name,price,currency,room,stay_month,israeli_deal,beds) VALUES('z','u','p','P',0,'NPR','private','2026-09',1,3)")
try:
 c.execute("INSERT INTO reports(id,user_id,place_id,place_name,price,currency,room,stay_month,israeli_deal) VALUES('bad','u','p','P',0,'NPR','private','2026-09',0)")
 assert False
except sqlite3.IntegrityError: pass
print('migration integrity passed')
`], { encoding: 'utf8' });
assert.match(result, /migration integrity passed/);
console.log(result.trim());
