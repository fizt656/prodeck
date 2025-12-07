import { DeckBuilder } from './components/DeckBuilder';

function App() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center py-20">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-md z-50 flex items-center px-8 border-b border-gray-200/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm" />
          <span className="font-semibold text-gray-900 tracking-tight">ProDeck</span>
        </div>
      </header>

      <main className="w-full mt-10">
        <DeckBuilder />
      </main>
    </div>
  )
}

export default App
