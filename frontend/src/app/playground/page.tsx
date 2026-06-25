"use client";

import { CodeEditor } from "@/components/playground/CodeEditor";
import { AssistantPanel } from "@/components/playground/AssistantPanel";
import { useRef, useState } from "react";

export default function PlaygroundPage() {
  const [output, setOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  // errorLog is populated from compilation output so the assistant has context
  const [errorLog, setErrorLog] = useState("");
  const getCodeRef = useRef<() => string>(() => "");

  const handleCompile = () => {
    setIsCompiling(true);
    setTimeout(() => {
      const compilationOutput =
        "✅ Compilation successful!\n📦 WASM size: 4.2KB\n🚀 Contract ready for simulation.";
      setOutput(compilationOutput);
      // Only surface errors to the assistant
      const errors = compilationOutput.includes("error")
        ? compilationOutput
        : "";
      setErrorLog(errors);
      setIsCompiling(false);
    }, 1500);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black text-white p-6 md:p-12 font-mono">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="mb-12 border-b border-white/10 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">
              Soroban <span className="text-red-500">Playground</span>
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Experimental Smart Contract Runtime v1.0.4
            </p>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest animate-pulse">
              ● Network Active: Stellar Testnet
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 flex-grow">
          {/* Editor */}
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 shadow-2xl relative flex flex-col min-h-[600px]">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                <span className="ml-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  contract.rs
                </span>
              </div>
              <div className="flex items-center gap-2 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">
                <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">
                  Collaborative Mode
                </span>
              </div>
            </div>

            <div className="flex-grow flex flex-col overflow-hidden rounded-xl border border-white/5">
              <CodeEditor
                roomName="main-lab-session"
                onEditorReady={(getValue) => {
                  getCodeRef.current = getValue;
                }}
              />
            </div>

            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className={`mt-4 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${
                isCompiling
                  ? "bg-zinc-800 text-gray-500 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]"
              }`}
            >
              {isCompiling ? "Compiling Context..." : "Execute Logic"}
            </button>
          </div>

          {/* Right column: terminal + assistant */}
          <div className="flex flex-col gap-6">
            <div className="bg-black border border-white/10 rounded-3xl p-8 flex-grow shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600/30"></div>
              <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-6">
                Execution_Output
              </h3>
              <pre className="text-xs text-red-500/80 leading-loose whitespace-pre-wrap font-mono">
                {output ||
                  "> Initializing environment...\n> Awaiting input signal..."}
              </pre>
              {isCompiling && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm transition-all">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
                      <div className="w-1/2 h-full bg-red-600 animate-[loading_1s_infinite]"></div>
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                      Processing WASM Bytecode
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Assistant panel */}
            <AssistantPanel
              getCode={() => getCodeRef.current()}
              errorLog={errorLog}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
