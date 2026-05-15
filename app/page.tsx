export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-center">
      <h1 className="text-6xl font-light text-white">Saathi</h1>
      <p className="mt-4 text-sm text-gray-400">Voice agent for Indian services</p>
      <button className="mt-10 flex h-32 w-32 items-center justify-center rounded-full bg-white text-5xl text-black">
        🎤
      </button>
      <div id="transcript-area" className="mt-8 min-h-20" />
    </main>
  );
}
