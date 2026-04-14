export interface User {
    id: string;
    email?: string;
}

export interface Loop {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    created_at: string;
}

export interface Contributor {
    id: string;
    loop_id: string;
    name: string;
    email: string;
}

export interface Submission {
    id: string;
    loop_id: string;
    contributor_id: string;
    content: string;
    created_at: string;
    contributors?: Contributor;
}
