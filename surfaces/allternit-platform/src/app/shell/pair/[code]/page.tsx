export async function generateStaticParams() {
  return []
}

export default function Page() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Pair Page</h1>
      <p>This feature requires a server runtime.</p>
      <p>Please use the desktop app or wait for full deployment.</p>
    </div>
  )
}
