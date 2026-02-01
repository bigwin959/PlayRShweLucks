exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { payload } = JSON.parse(event.body);
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO_OWNER = process.env.REPO_OWNER;
        const REPO_NAME = process.env.REPO_NAME;
        const BRANCH = 'main';
        const FILE_PATH = 'data.json';

        if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Missing Connection Settings' })
            };
        }

        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

        // 1. Get current SHA
        const currentFileReq = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
        });

        if (!currentFileReq.ok) {
            throw new Error(`Failed to fetch SHA: ${currentFileReq.statusText}`);
        }

        const currentFile = await currentFileReq.json();

        // 2. Update File
        const updateReq = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Update data.json via Admin Panel [${new Date().toISOString()}]`,
                content: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
                sha: currentFile.sha,
                branch: BRANCH
            })
        });

        if (!updateReq.ok) {
            const err = await updateReq.json();
            throw new Error(`GitHub Commit Failed: ${err.message}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Saved successfully!' })
        };

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
