import Link from 'next/link';

export default function NotFound() {
  return <main className="wrap nf">
    <div className="nf-icon">🧭</div>
    <h1>המקום הזה לא נמצא</h1>
    <p className="muted">אולי הקישור השתנה, או שהמקום הוסר מהמפה. אפשר לחפש אותו מחדש.</p>
    <Link className="btn primary big block" href="/">לדף הבית</Link>
  </main>;
}
