import { RoomState } from '../types';
import { createJigsawPieces } from './jigsawHelper';

export const PRESET_IMAGES = [
  {
    id: 'preset-solar',
    title: 'Solar System & Planetary Orbit',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=1200&auto=format&fit=crop',
    gridCols: 4,
    gridRows: 3,
    defaultQuestion: {
      text: 'Why does Mars appear distinctively reddish from Earth, and what chemical compound dominates its dusty surface?',
      sampleAnswer: 'Mars has a reddish tint due to large concentrations of iron oxide (ferric rust) covering its regolith and reacting with atmospheric trace elements.',
      explanation: 'Atmospheric winds constantly kick up fine dust particles of iron oxide, giving the Martian sky and surface a characteristic red-orange hue.',
    },
  },
  {
    id: 'preset-rainforest',
    title: 'Amazon Rainforest Canopy',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    gridCols: 4,
    gridRows: 3,
    defaultQuestion: {
      text: 'How does the dense Amazon forest canopy regulate regional rainfall patterns and store carbon globally?',
      sampleAnswer: 'Trees perform intense evapotranspiration, generating "flying rivers" of water vapor that create rain across the continent while sequestering billions of metric tons of carbon dioxide.',
      explanation: 'A single large rainforest tree can release hundreds of liters of water into the atmosphere daily through transpiration.',
    },
  },
  {
    id: 'preset-heritage',
    title: 'Ancient World Architecture',
    url: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop',
    gridCols: 3,
    gridRows: 3,
    defaultQuestion: {
      text: 'What architectural engineering techniques allowed ancient temples and monuments to stand for thousands of years?',
      sampleAnswer: 'Builders utilized precise post-and-beam interlocking joinery, dry-stone masonry with flexible mortar, and foundational weight distributions that withstand earthquakes.',
      explanation: 'Advanced stone craftsmanship and mathematical symmetry allowed structures to distribute load vectors evenly without modern steel reinforcement.',
    },
  },
  {
    id: 'preset-ocean',
    title: 'Deep Coral Reef Ecosystems',
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1200&auto=format&fit=crop',
    gridCols: 5,
    gridRows: 4,
    defaultQuestion: {
      text: 'Why are coral reefs considered vital "underwater nurseries" and how do they shield coastline communities?',
      sampleAnswer: 'They provide shelter and feeding grounds for over a quarter of all marine species, and absorb up to 97% of wave energy, acting as natural storm buffers.',
      explanation: 'Complex calcium carbonate reef frameworks reduce shoreline erosion and protect low-lying coastal regions from cyclonic storm surges.',
    },
  },
];

export const INITIAL_ROOM_TEMPLATES = [
  {
    id: 'room-1',
    name: 'Team Nebula',
    badge: '🚀',
    color: 'indigo',
    accentColor: '#6366f1',
    presetIndex: 0,
  },
  {
    id: 'room-2',
    name: 'Team Vortex',
    badge: '⚡',
    color: 'sky',
    accentColor: '#0ea5e9',
    presetIndex: 1,
  },
  {
    id: 'room-3',
    name: 'Team Aurora',
    badge: '🌌',
    color: 'emerald',
    accentColor: '#10b981',
    presetIndex: 2,
  },
  {
    id: 'room-4',
    name: 'Team Phoenix',
    badge: '🔥',
    color: 'rose',
    accentColor: '#f43f5e',
    presetIndex: 3,
  },
];

export function createInitialRooms(defaultRows = 3, defaultCols = 3): Record<string, RoomState> {
  const rooms: Record<string, RoomState> = {};
  const total = defaultRows * defaultCols;

  INITIAL_ROOM_TEMPLATES.forEach((tmpl, idx) => {
    const preset = PRESET_IMAGES[idx % PRESET_IMAGES.length];
    rooms[tmpl.id] = {
      id: tmpl.id,
      name: tmpl.name,
      badge: tmpl.badge,
      color: tmpl.color,
      accentColor: tmpl.accentColor,
      imageUrl: preset.url,
      imageTitle: preset.title,
      gridRows: defaultRows,
      gridCols: defaultCols,
      totalPieces: total,
      pieces: createJigsawPieces(defaultRows, defaultCols),
      status: 'WAITING',
      question: { ...preset.defaultQuestion },
      members: [],
      startTime: null,
      puzzleCompletedTime: null,
      questionCompletedTime: null,
      totalDurationMs: null,
      answerSubmitted: null,
    };
  });

  return rooms;
}
