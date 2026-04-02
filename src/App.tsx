import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">
        Welcome to Tauri2 Template
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
          />
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md 
                       transition-colors duration-200 font-medium"
            onClick={() => greet()}
          >
            Greet
          </button>
        </div>

        {greetMsg && (
          <p className="mt-4 text-center text-gray-700 dark:text-gray-300">{greetMsg}</p>
        )}
      </div>

      <div className="mt-8 text-sm text-gray-500 dark:text-gray-400 text-center">
        <p>Built with Tauri 2 + React + Vite + Tailwind CSS</p>
        <p className="mt-2">
          <a
            href="https://tauri.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Learn more about Tauri
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
