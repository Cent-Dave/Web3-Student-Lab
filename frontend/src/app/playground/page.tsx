'use client';


import { CodeEditor } from "@/components/playground/CodeEditor";
import { AssistantPanel } from "@/components/playground/AssistantPanel";
import { useRef, useState } from "react";

export default function PlaygroundPage() {
  const [output, setOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  // errorLog is populated from compilation output so the assistant has context
  const [errorLog, setErrorLog] = useState("");
  const getCodeRef = useRef<() => string>(() => "");


  useEffect(() => {
    filePresenceManager.setActiveFile(activeFilePath);
  }, [activeFilePath, filePresenceManager]);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => setSyncState(state));
    return unsubscribe;
  }, [syncManager]);

  useEffect(() => {
    const setupPersistence = async () => {
      await syncManager.restoreYDoc(provider.doc, 'playground-main-lab-session');
      const cleanup = syncManager.attachYDocPersistence(
        provider.doc,
        'playground-main-lab-session'
      );
      setPendingCount(syncManager.getPendingChanges().length);
      return cleanup;
    };

    let cleanupFn: null | (() => Promise<void>) = null;
    setupPersistence().then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [provider.doc, syncManager]);

  useEffect(() => {
    const persistActiveFile = async () => {
      await databaseManager.setMetadata('playground:active-file', activeFilePath);
    };
    persistActiveFile();
  }, [activeFilePath, databaseManager]);

  const handleCompile = useCallback(() => {
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
  }, [activeFilePath]);

  useEffect(() => {
    const handleShortcutCompile = () => {
      if (!isCompiling) {
        handleCompile();
      }
    };

    document.addEventListener('playground-compile', handleShortcutCompile as EventListener);
    return () => {
      document.removeEventListener('playground-compile', handleShortcutCompile as EventListener);
    };
  }, [handleCompile, isCompiling]);

  useEffect(() => {
    const restoreActiveFile = async () => {
      const stored = await databaseManager.getMetadata('playground:active-file');
      if (stored?.value) {
        setActiveFilePath(stored.value);
      }
    };
    restoreActiveFile();
  }, [databaseManager]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black p-6 font-mono text-white md:p-12">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <div className="mb-12 flex items-end justify-between border-b border-white/10 pb-6" data-tour-step="playground-header">
          <div>
            <h1 className="mb-2 text-4xl font-black tracking-tighter uppercase">
              Soroban <span className="text-red-500">Playground</span>
            </h1>
            <p className="text-xs tracking-widest text-gray-500 uppercase">
              Experimental Smart Contract Runtime v1.0.4
            </p>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <span className="animate-pulse text-[10px] font-bold tracking-widest text-green-500 uppercase">
              ● Network Active: Stellar Testnet
            </span>
            <button
              onClick={() => startTutorial('playground')}
              className="rounded border border-red-600/30 bg-red-600/10 px-4 py-2 text-[10px] font-black tracking-widest text-red-500 uppercase transition-colors hover:bg-red-600/20"
              aria-label="Start playground tutorial"
            >
              ? Tutorial
            </button>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 flex-grow">
          {/* Editor */}
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 shadow-2xl relative flex flex-col min-h-[600px]">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4 justify-between"
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-zinc-700"></div>
                <div className="h-3 w-3 rounded-full bg-zinc-700"></div>
                <span className="ml-4 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  {activeFilePath}
                </span>
              </div>
              <div className="flex self-start sm:self-auto items-center gap-2 rounded-full border border-red-600/20 bg-red-600/10 px-3 py-1">
                <span className="text-[9px] font-black tracking-widest text-red-500 uppercase">
                  Collaborative Mode
                </span>
              </div>

              <div className="flex items-center gap-2 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">
                <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">
                  Collaborative Mode
                </span>

              </div>
              <VirtualizedFileTree
                nodes={treeData}
                activeFilePath={activeFilePath}
                filePresenceManager={filePresenceManager}
                onSelectFile={setActiveFilePath}
                onMoveFile={(sourcePath, targetFolderPath) => {
                  setTreeData((prev) => moveFileNode(prev, sourcePath, targetFolderPath));
                }}
              />
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
              data-tour-step="playground-compile-btn"
              className={`mt-4 rounded-xl py-4 text-xs font-black tracking-[0.2em] uppercase transition-all ${
                isCompiling
                  ? 'cursor-not-allowed bg-zinc-800 text-gray-500'
                  : 'bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]'
              }`}
            >
              {isCompiling ? 'Compiling Context...' : 'Execute Logic'}
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
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-settings-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2
                id="editor-settings-title"
                className="text-sm font-black tracking-widest text-white uppercase"
              >
                Editor Settings
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:text-white"
                aria-label="Close editor settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-6">
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-xs font-bold tracking-widest text-zinc-400 uppercase">
                  Font Size <span className="text-white">{editorSettings.fontSize}px</span>
                </span>
                <input
                  type="range"
                  min={12}
                  max={22}
                  step={1}
                  value={editorSettings.fontSize}
                  onChange={(event) =>
                    setEditorSettings((prev) => ({
                      ...prev,
                      fontSize: Number(event.target.value),
                    }))
                  }
                  className="h-2 w-full cursor-pointer accent-red-600"
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-xs font-bold tracking-widest text-zinc-400 uppercase">
                  Tab Size <span className="text-white">{editorSettings.tabSize}</span>
                </span>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={2}
                  value={editorSettings.tabSize}
                  onChange={(event) =>
                    setEditorSettings((prev) => ({
                      ...prev,
                      tabSize: Number(event.target.value),
                    }))
                  }
                  className="h-2 w-full cursor-pointer accent-red-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <span className="text-xs font-bold tracking-widest text-zinc-300 uppercase">
                  Vim Bindings
                </span>
                <input
                  type="checkbox"
                  checked={editorSettings.vimBindings}
                  onChange={(event) =>
                    setEditorSettings((prev) => ({
                      ...prev,
                      vimBindings: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-red-600"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
