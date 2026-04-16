import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { addDoc } from 'firebase/firestore'

// jsdom doesn't support scrollIntoView, so we must mock it
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock motion to avoid animation issues in jsdom
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock lucide-react to avoid missing icons issues and make finding elements easier
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react') as any;
  return {
    ...actual,
    Mic: (props: any) => <svg data-testid="mic-icon" {...props} />,
  }
});

// Mock firebase
vi.mock('./firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user', email: 'test@example.com' },
    signOut: vi.fn(),
  }
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((query, cb) => {
    // Return some mock leads so that "selectedLead" is set and we can start recording
    cb({
      docs: [
        { id: 'lead-1', data: () => ({ name: 'John Doe', status: 'new', lastMessage: 'Hello' }) }
      ]
    });
    return () => {};
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-id' }),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [] })),
  setDoc: vi.fn(),
  where: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'test-user', email: 'test@example.com' });
    return () => {};
  }),
  signOut: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, text: "AI response" })
});

// Setup MediaRecorder Mock
let mockMediaRecorderInstances: any[] = [];
class MockMediaRecorder {
  stream: any;
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => Promise<void> | void) | null = null;
  state: string = 'inactive';

  constructor(stream: any) {
    this.stream = stream;
    mockMediaRecorderInstances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      // Execute immediately in test to avoid setTimeout flakes
      this.onstop();
    }
  }

  // Helper method to simulate data
  simulateData(size: number, type: string = 'audio/webm') {
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob([new ArrayBuffer(size)], { type }) });
    }
  }
}

// Ensure Blob and FormData exists in jsdom and allow us to mock it simply
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    size: number;
    type: string;
    constructor(chunks: any[], options: any) {
      this.size = chunks.length ? chunks[0].size : 0;
      this.type = options?.type || '';
    }
  } as any;
}

// Ensure FormData is mocked because jsdom FormData might lack append implementation or we just want to avoid errors
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    append() {}
  } as any;
}

// Mock console.error/log
const originalError = console.error;
const originalLog = console.log;
const originalAlert = window.alert;

beforeEach(() => {
  console.error = vi.fn();
  console.log = vi.fn();
  window.alert = vi.fn();
  mockMediaRecorderInstances = [];

  // Setup getUserMedia Mock
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      }),
    },
    writable: true,
  });

  // Setup MediaRecorder
  Object.defineProperty(window, 'MediaRecorder', {
    value: MockMediaRecorder,
    writable: true,
  });
});

afterEach(() => {
  console.error = originalError;
  console.log = originalLog;
  window.alert = originalAlert;
  vi.clearAllMocks();
});

export { mockMediaRecorderInstances };

// Helper to select a lead and show the mic icon
const selectLeadAndGetMic = async () => {
  render(<App />);

  const sidebarButtons = document.querySelectorAll('nav.flex.flex-col.gap-6 > button');
  if (sidebarButtons.length > 0) {
    fireEvent.click(sidebarButtons[0]); // chat is usually the first icon
  }

  const johnDoes = await screen.findAllByText('John Doe');
  const chatSidebarLead = johnDoes.find(el => el.tagName === 'H3' || el.tagName === 'DIV');
  if (chatSidebarLead) {
    fireEvent.click(chatSidebarLead.closest('div.cursor-pointer') || chatSidebarLead);
  }

  await waitFor(() => {
    expect(screen.getByTestId('mic-icon')).toBeInTheDocument();
  });

  const micIcon = screen.getByTestId('mic-icon');
  return micIcon.closest('button');
};

describe('App startRecording logic', () => {
  it('should render', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('should call getUserMedia and start MediaRecorder when mic button is pressed', async () => {
    const micButton = await selectLeadAndGetMic();
    expect(micButton).not.toBeNull();

    // Start recording
    if (micButton) {
      fireEvent.mouseDown(micButton);
    }

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    expect(mockMediaRecorderInstances.length).toBe(1);
    expect(mockMediaRecorderInstances[0].state).toBe('recording');
  });

  it('should handle microphone access errors gracefully', async () => {
    (global.navigator.mediaDevices.getUserMedia as Mock).mockRejectedValueOnce(new Error('Permission denied'));

    const micButton = await selectLeadAndGetMic();

    if (micButton) {
      fireEvent.mouseDown(micButton);
    }

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Error accessing microphone:", expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith("Could not access microphone. Please check permissions.");
    });

    expect(mockMediaRecorderInstances.length).toBe(0);
  });

  it('should collect audio chunks and trigger state changes on record/stop', async () => {
    const micButton = await selectLeadAndGetMic();

    if (micButton) {
      fireEvent.mouseDown(micButton);
    }

    await waitFor(() => {
      expect(mockMediaRecorderInstances.length).toBe(1);
    });

    // Wait for the recording state to be set
    await waitFor(() => {
       expect(micButton?.className).toContain('animate-pulse');
    });

    const recorder = mockMediaRecorderInstances[0];

    // Simulate data available with size > 0
    recorder.simulateData(1024);

    // Test that the mock received the data chunk correctly
    // We cannot easily spy on the ref, but we can verify the behavior that the component calls stop properly
    // and correctly flips isRecording back to false which removes the animate-pulse class.
    if (micButton) {
      fireEvent.mouseUp(micButton);
    }

    // Verify that the UI drops the recording state
    await waitFor(() => {
       expect(recorder.state).toBe('inactive');
       expect(micButton?.className).not.toContain('animate-pulse');
    });
  });
});
