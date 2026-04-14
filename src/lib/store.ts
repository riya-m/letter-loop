import type { Loop, Submission } from '../types';

export interface Question {
    id: string;
    text: string;
    author: string;
    created_at: string;
}

export interface Answer {
    id: string;
    question_id: string;
    text: string;
    author: string;
    created_at: string;
}

export interface BlobState {
    loop: Partial<Loop> & { phase?: 1 | 2 | 3 };
    questions: Question[];
    answers: Answer[];
    submissions: Submission[];
}

const JSONBLOB_API = '/api/jsonBlob';

// Admin maintains their tracked loops in local storage
export const getAdminLoops = () => {
    const data = localStorage.getItem('admin_loops');
    return data ? JSON.parse(data) : [];
};

export const isAdmin = (loopId: string) => {
    const loops = getAdminLoops();
    return loops.some((l: any) => l.id === loopId);
};

export const addAdminLoop = (id: string, title: string, description: string) => {
    const loops = getAdminLoops();
    loops.push({ id, title, description, created_at: new Date().toISOString() });
    localStorage.setItem('admin_loops', JSON.stringify(loops));
};

export const createLoopBlob = async (title: string, description: string): Promise<string> => {
    const initialState: BlobState = {
        loop: { title, description, phase: 1 },
        questions: [],
        answers: [],
        submissions: []
    };

    const res = await fetch(JSONBLOB_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(initialState)
    });

    const loc = res.headers.get('Location') || res.headers.get('x-jsonblob-id');
    if (res.headers.get('x-jsonblob-id')) {
        return res.headers.get('x-jsonblob-id')!;
    }

    const parts = loc?.split('/') || [];
    return parts[parts.length - 1];
};

export const fetchBlobState = async (blobId: string): Promise<BlobState> => {
    const res = await fetch(`${JSONBLOB_API}/${blobId}`);
    if (!res.ok) throw new Error('Blob not found');
    const data = await res.json();
    if (!data.loop.phase) data.loop.phase = 1; // Fallback for old data
    return data;
};

export const updateBlobState = async (blobId: string, state: BlobState): Promise<void> => {
    await fetch(`${JSONBLOB_API}/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(state)
    });
};
