const handlers = {};
export function register(event, handler) {
    handlers[event] = handler;
}
export async function dispatch(event) {
    const h = handlers[event.hook_event_name];
    if (!h)
        return {};
    try {
        return await h(event);
    }
    catch (err) {
        return { additionalContext: `[tokenstack error] ${err.message}` };
    }
}
async function main() {
    const chunks = [];
    for await (const c of process.stdin)
        chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let event;
    try {
        event = JSON.parse(raw);
    }
    catch {
        process.exit(0);
    }
    const response = await dispatch(event);
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    void main();
}
