'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, Mic, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import eventsData from '../events.json';

interface Show {
  date: string;
  venue: string;
  times: string[];
}

interface Event {
  id: string;
  cat: string;
  title: string;
  lang: string;
  age: string;
  price: number;
  shows: Show[];
}

const EVENTS: Event[] = eventsData as Event[];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EventCard({ event }: { event: Event }) {
  const firstShow = event.shows[0];
  const hasMoreShows = event.shows.length > 1;

  return (
    <div className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white hover:border-gray-300">
      <div className="mb-3">
        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
          {event.cat}
        </span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2">
        {event.title}
      </h3>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-700 min-w-14">Venue:</span>
          <span>
            {firstShow.venue}
            {hasMoreShows && ` (+${event.shows.length - 1} more)`}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-700 min-w-14">Date:</span>
          <span>
            {formatDate(firstShow.date)}
            {hasMoreShows && ` – ${formatDate(event.shows[event.shows.length - 1].date)}`}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-700 min-w-14">Times:</span>
          <span>{firstShow.times.join(', ')}</span>
        </div>

        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-700 min-w-14">Price:</span>
          <span>₹{event.price}</span>
        </div>
      </div>
    </div>
  );
}

function FallbackCard() {
  return (
    <div className="max-w-md w-full mx-auto">
      <div className="p-8 border border-amber-200 rounded-xl bg-gradient-to-b from-amber-50/80 to-white shadow-lg shadow-amber-100/50">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-amber-100">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-3">
          No exact matches, but we have an idea...
        </h2>
        <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">
          We couldn&apos;t find a scheduled show fitting your exact time and budget.
          However, the nearby Nexus Shantiniketan Mall has an interactive VR gaming
          zone and bowling alley you can walk into right now!
        </p>
        <a
          href="https://www.google.com/maps/search/Nexus+Shantiniketan+Mall+Bangalore"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Get Directions
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      const ids: string[] = data.ids ?? [];
      const matched = EVENTS.filter((e) => ids.includes(e.id));
      setFilteredEvents(matched);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setFilteredEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleMicClick = useCallback(async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);

        if (chunks.length === 0) {
          setMicError('No audio recorded. Please try again.');
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], 'recording.webm', { type: mimeType });

        setIsTranscribing(true);
        setMicError(null);

        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Transcription failed');
          }

          const text = data.text?.trim() ?? '';
          if (text) {
            setSearchQuery(text);
            performSearch(text);
          } else {
            setMicError('No speech detected. Please try again.');
          }
        } catch (err) {
          setMicError('Transcription failed. Please try again.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsListening(true);
      setMicError(null);
    } catch (err) {
      setIsListening(false);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setMicError('Microphone permission denied. Please enable it in your browser settings.');
      } else {
        setMicError('Error accessing microphone. Please try again.');
      }
    }
  }, [isListening, performSearch]);

  const micDisabled = isLoading || isTranscribing;
  const statusText = isListening
    ? 'Listening...'
    : isTranscribing
      ? 'Transcribing...'
      : null;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      {/* Hero Section */}
      <div className="max-w-2xl w-full mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2 tracking-tight">
          What do you want to do in Bengaluru?
        </h1>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl w-full mb-12">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div className="flex items-center gap-3 px-6 py-4 border border-gray-300 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-gray-400 flex-shrink-0 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}

              <input
                type="text"
                placeholder={
                  isLoading
                    ? 'Thinking...'
                    : isTranscribing
                      ? 'Transcribing...'
                      : 'Search events, music, food, sports...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading || isTranscribing}
                className="flex-1 outline-none text-gray-900 placeholder-gray-500 bg-transparent disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label="Search events"
              />

              <button
                type="button"
                onClick={handleMicClick}
                disabled={micDisabled}
                className={`flex-shrink-0 p-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isListening ? 'bg-red-100' : 'hover:bg-gray-100'
                }`}
                aria-label={isListening ? 'Stop recording' : 'Start voice search'}
                title={isListening ? 'Listening...' : 'Voice search'}
              >
                <Mic
                  className={`w-5 h-5 ${
                    isListening ? 'text-red-600' : 'text-gray-400'
                  }`}
                />
              </button>
            </div>

            {micError && (
              <div className="mt-3 text-sm text-red-600 text-center">
                {micError}
              </div>
            )}

            {statusText && (
              <div className="mt-3 text-sm text-gray-600 text-center animate-pulse">
                {statusText}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-2xl w-full mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Results Grid */}
      {hasSearched && !error && filteredEvents.length > 0 && (
        <div className="max-w-4xl w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <div className="text-center text-sm text-gray-500 mb-8">
            Found {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Fallback Card - Empty results */}
      {hasSearched && !error && filteredEvents.length === 0 && (
        <div className="w-full flex justify-center">
          <FallbackCard />
        </div>
      )}
    </main>
  );
}
