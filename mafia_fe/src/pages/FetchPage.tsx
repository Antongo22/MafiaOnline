import { useEffect, useState } from "react";

type FetchPageProps = {
url: string;
};

export function FetchPage({ url }: FetchPageProps) {
const [data, setData] = useState<any>(null);
const [loading, setLoading] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
    async function load() {
    try {
        setLoading(true);
        setError(null);

        const response = await fetch(url);

        if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
        }

        const json = await response.json();
        setData(json);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
    } finally {
        setLoading(false);
    }
    }

    load();
}, [url]); // зависимость: если url изменится → новый запрос

return (
    <div style={{ padding: 20 }}>
    <h1>API Fetch Example</h1>

    {loading && <p>Loading...</p>}
    {error && <p style={{ color: "red" }}>Error: {error}</p>}

    {data && (
        <pre style={{
        background: "#1e1e1e",
        padding: "10px",
        borderRadius: 6,
        color: "#fff",
        overflowX: "auto"
        }}>
        {JSON.stringify(data, null, 2)}
        </pre>
    )}
    </div>
);
}