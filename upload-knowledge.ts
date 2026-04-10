/**
 * Upload knowledge from Firestore prompts/super-manager to Pillar API as snippets.
 *
 * Usage:
 *   npx tsx upload-knowledge.ts
 *
 * Requires:
 *   PILLAR_API_URL, PILLAR_EMAIL, PILLAR_PASSWORD
 *   Firebase credentials (GOOGLE_APPLICATION_CREDENTIALS or default)
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PILLAR_API_URL = process.env.PILLAR_API_URL || 'https://pillar-api.brendi.com.br';
const PILLAR_EMAIL = process.env.PILLAR_EMAIL || 'pedro@brendi.com.br';
const PILLAR_PASSWORD = process.env.PILLAR_PASSWORD || 'brendi123';
const PRODUCT_SUBDOMAIN = 'brendi-copilot';

type Category = {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
};

type Prompt = {
    id: string;
    name: string;
    prompt: string;
    enabled: boolean;
    type?: string;
    keywords?: string[];
    categoryId?: string;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string;
    validateAt?: string;
};

async function getAuthToken(): Promise<string> {
    console.log(`[auth] Logging in as ${PILLAR_EMAIL}...`);
    const res = await fetch(`${PILLAR_API_URL}/api/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: PILLAR_EMAIL, password: PILLAR_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json() as { access: string };
    console.log(`[auth] Logged in`);
    return data.access;
}

async function getProductId(token: string): Promise<string> {
    const res = await fetch(`${PILLAR_API_URL}/api/admin/configs/`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to get products: ${res.status}`);
    const data = await res.json() as { results: Array<{ id: string; subdomain: string }> };
    const product = data.results.find((p: { subdomain: string }) => p.subdomain === PRODUCT_SUBDOMAIN);
    if (!product) throw new Error(`Product ${PRODUCT_SUBDOMAIN} not found`);
    console.log(`[product] Found: ${product.id}`);
    return product.id;
}

async function loadFirestoreData(): Promise<{ categories: Category[]; prompts: Prompt[] }> {
    if (getApps().length === 0) {
        initializeApp();
    }
    const db = getFirestore();

    console.log('[firestore] Loading categories...');
    const catSnap = await db.collection('prompts').doc('super-manager').collection('categories').get();
    const categories: Category[] = catSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as Category[];
    console.log(`[firestore] ${categories.length} categories loaded`);

    console.log('[firestore] Loading prompts...');
    const promptSnap = await db.collection('prompts').doc('super-manager').collection('list').get();
    const prompts: Prompt[] = [];
    for (const doc of promptSnap.docs) {
        const data = doc.data();
        if (data.enabled) {
            prompts.push({
                id: doc.id,
                name: data.name,
                prompt: data.prompt,
                enabled: data.enabled,
                type: data.type,
                keywords: data.keywords,
                categoryId: data.categoryId,
                createdBy: data.createdBy,
                validateAt: data.validateAt,
            });
        }
    }
    console.log(`[firestore] ${prompts.length} enabled prompts loaded`);

    return { categories, prompts };
}

async function uploadSnippet(
    token: string,
    productId: string,
    title: string,
    content: string,
    categoryName?: string,
    keywords?: string[],
): Promise<boolean> {
    const body: Record<string, unknown> = {
        title,
        content,
        is_active: true,
        metadata: {
            ...(categoryName && { category: categoryName }),
            ...(keywords?.length && { keywords }),
            source: 'firestore-migration',
        },
    };

    const res = await fetch(
        `${PILLAR_API_URL}/api/admin/knowledge/snippets/?product=${productId}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        },
    );

    if (!res.ok) {
        const err = await res.text();
        console.error(`  [FAIL] "${title}": ${res.status} ${err}`);
        return false;
    }

    return true;
}

async function main() {
    const token = await getAuthToken();
    const productId = await getProductId(token);
    const { categories, prompts } = await loadFirestoreData();

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    console.log(`\n[upload] Uploading ${prompts.length} snippets to Pillar...\n`);

    let success = 0;
    let failed = 0;

    for (const prompt of prompts) {
        const categoryName = prompt.categoryId ? categoryMap.get(prompt.categoryId) : undefined;
        const title = categoryName ? `[${categoryName}] ${prompt.name}` : prompt.name;

        const ok = await uploadSnippet(
            token,
            productId,
            title,
            prompt.prompt,
            categoryName,
            prompt.keywords,
        );

        if (ok) {
            success++;
            console.log(`  [OK] ${title}`);
        } else {
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n[done] ${success} uploaded, ${failed} failed out of ${prompts.length} total`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
