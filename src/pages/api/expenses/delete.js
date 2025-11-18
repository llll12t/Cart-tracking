import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing expense id' });
  }
  try {
    await deleteDoc(doc(db, 'expenses', id));
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
