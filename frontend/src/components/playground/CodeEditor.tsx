import Editor, { OnMount } from '@monaco-editor/react';
import React, { useEffect, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import { useWebSocketStatus } from '../../lib/collaboration/WebSocketManager';
import { CollaborationProvider } from '../../lib/collaboration/YjsProvider';

interface CodeEditorProps {
  roomName: string;
  /** Called once the editor mounts; receives a function that returns current code. */
  onEditorReady?: (getValue: () => string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ roomName, onEditorReady }) => {
  const providerRef = useRef<CollaborationProvider | null>(null);
  const editorRef = useRef<any>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  useEffect(() => {
    providerRef.current = new CollaborationProvider(roomName);
    return () => {
      providerRef.current?.destroy();
      bindingRef.current?.destroy();
    };
  }, [roomName]);

  const status = useWebSocketStatus(providerRef.current);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    onEditorReady?.(() => editor.getValue());

    if (providerRef.current) {
      const type = providerRef.current.doc.getText('monaco');
      bindingRef.current = new MonacoBinding(
        type,
        editor.getModel()!,
        new Set([editor]),
        providerRef.current.awareness
      );
    }

    // Custom theme for Monaco to match the app aesthetic
    monaco.editor.defineTheme('web3-lab-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ef4444', fontStyle: 'bold' },
        { token: 'string', foreground: '10b981' },
      ],
      colors: {
        'editor.background': '#09090b',
        'editor.lineHighlightBackground': '#18181b',
        'editorCursor.foreground': '#ef4444',
      }
    });

    monaco.editor.setTheme('web3-lab-dark');
  };

  return (
    <div className="flex-grow flex flex-col relative group">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-4">
        <div className="flex -space-x-2">
          {/* We could map over awareness states here to show avatars */}
          <div className="w-6 h-6 rounded-full border-2 border-black bg-red-500 flex items-center justify-center text-[8px] font-bold">ME</div>
        </div>
        <div className={`flex items-center gap-2 px-2 py-1 rounded bg-black/50 border border-white/10 text-[9px] uppercase font-bold tracking-tighter ${
          status === 'connected' ? 'text-green-500' : status === 'connecting' ? 'text-amber-500' : 'text-red-500'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            status === 'connected' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
          }`} />
          {status}
        </div>
      </div>

      <Editor
        height="100%"
        defaultLanguage="rust"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'monospace',
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: false,
          theme: 'web3-lab-dark',
          automaticLayout: true,
          padding: { top: 20 },
        }}
      />
    </div>
  );
};
