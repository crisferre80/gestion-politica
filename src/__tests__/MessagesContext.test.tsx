import { renderHook, act } from '@testing-library/react';
import { MessagesProvider, useMessages } from '../context/MessagesContext';
import { supabase } from '../lib/supabase';

// Mock supabase
jest.mock('../lib/supabase');

const mockProfiles = [
  { id: '1', user_id: 'user-uuid-1' },
  { id: '2', user_id: 'user-uuid-2' }
];
const mockMessages = [
  {
    id: 10,
    sender_id: '1',
    receiver_id: '2',
    content: 'Hola',
    sent_at: '2025-06-01T12:00:00.000Z'
  },
  {
    id: 11,
    sender_id: '2',
    receiver_id: '1',
    content: '¡Hola! ¿Cómo estás?',
    sent_at: '2025-06-01T12:01:00.000Z'
  }
];

describe('MessagesContext - flujo de consulta y envío', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('consulta correctamente la conversación entre dos usuarios', async () => {
    // Mock perfiles
    supabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        // Usamos un objeto builder con tipado explícito
        type Builder = {
          select: () => Builder;
          eq: (col: string, value: string) => Builder;
          single: () => { data: typeof mockProfiles[0] | undefined };
          __eqValue?: string;
        };
        const builder: Builder = {
          select() { return this; },
          eq(_col, value) { this.__eqValue = value; return this; },
          single() { const userId = this.__eqValue; return { data: mockProfiles.find(p => p.user_id === userId) }; },
          __eqValue: undefined,
        };
        return builder;
      }
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockMessages }),
        };
      }
      return {};
    });

    // Render hook
    const wrapper = ({ children }: { children: React.ReactNode }) => <MessagesProvider>{children}</MessagesProvider>;
    const { result } = renderHook(() => useMessages(), { wrapper });

    // Act: fetchConversation
    await act(async () => {
      await result.current.fetchConversation('user-uuid-1', 'user-uuid-2');
    });

    // Verifica que los mensajes se adaptan correctamente
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].senderId).toBe('user-uuid-1');
    expect(result.current.messages[0].receiverId).toBe('user-uuid-2');
    expect(result.current.messages[1].senderId).toBe('user-uuid-2');
    expect(result.current.messages[1].receiverId).toBe('user-uuid-1');
  });

  it('envía un mensaje correctamente', async () => {
    // Mock perfiles y mensajes
    const insertMock = jest.fn().mockResolvedValue({});
    supabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        type Builder = {
          select: () => Builder;
          eq: (col: string, value: string) => Builder;
          single: () => { data: typeof mockProfiles[0] | undefined };
          __eqValue?: string;
        };
        const builder: Builder = {
          select() { return this; },
          eq(_col, value) { this.__eqValue = value; return this; },
          single() { const userId = this.__eqValue; return { data: mockProfiles.find(p => p.user_id === userId) }; },
          __eqValue: undefined,
        };
        return builder;
      }
      if (table === 'messages') {
        return {
          insert: insertMock
        };
      }
      return {};
    });

    // Render hook
    const wrapper = ({ children }: { children: React.ReactNode }) => <MessagesProvider>{children}</MessagesProvider>;
    const { result } = renderHook(() => useMessages(), { wrapper });

    // Act: sendMessage
    await act(async () => {
      await result.current.sendMessage('user-uuid-1', 'user-uuid-2', 'Nuevo mensaje');
    });

    // Verifica que el insert se llamó con los IDs internos correctos
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        sender_id: '1',
        receiver_id: '2',
        content: 'Nuevo mensaje',
      })
    ]);
  });
});
