import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

import MobileMapOverlay from '../components/map/MobileMapOverlay.vue'

const createTestSpots = () => [
  {
    id: 'spot-1',
    title: 'Alpine Viewpoint',
    description: 'Scenic mountain lookout.',
    owner_id: 'user-2',
    lat: 47.3769,
    lon: 8.5417,
    tags: ['nature', 'hiking'],
    visibility: 'public',
    images: [],
  },
  {
    id: 'spot-2',
    title: 'City Riverside',
    description: 'Evening city walk.',
    owner_id: 'user-3',
    lat: 47.3842,
    lon: 8.5324,
    tags: ['city', 'walking'],
    visibility: 'public',
    images: [],
  },
]

const createMockLocationResults = () => [
  { id: 'loc-1', label: 'Zurich HB, Bahnhofplatz', type: 'station', lat: 47.3782, lon: 8.5403 },
  { id: 'loc-2', label: 'Zurich, Bahnhofstrasse', type: 'street', lat: 47.3769, lon: 8.5417 },
]

function createWrapper(props = {}) {
  const defaultProps = {
    spots: createTestSpots(),
    filteredSpots: createTestSpots(),
    listedSpots: createTestSpots(),
    center: [47.3769, 8.5417],
    zoom: 12,
    maxBounds: null,
    filters: { text: '', tagsText: '', ownerText: '', visibility: 'all', onlyFavorites: false, radiusKm: 0 },
    activeLocationLabel: '',
    resultCount: 2,
    totalCount: 2,
    canReset: false,
    subscriptions: [],
    locationQuery: '',
    locationSearchBusy: false,
    locationSearchError: '',
    locationResults: [],
    activeLocation: null,
    ownerLabel: () => 'Test User',
    spotDistanceLabel: () => '2.5 km away',
    isFavorite: () => false,
    canReportSpot: () => true,
    canLoadMore: false,
    remainingCount: 0,
    onMapTap: vi.fn(),
    onMarkerSelect: vi.fn(),
    onViewportChange: vi.fn(),
    onUpdateFilters: vi.fn(),
    onResetFilters: vi.fn(),
    onSubscribeFilters: vi.fn(),
    onApplySubscription: vi.fn(),
    onRemoveSubscription: vi.fn(),
    onUpdateLocationQuery: vi.fn(),
    onSearchLocation: vi.fn(async () => {}),
    onSelectLocation: vi.fn(),
    onClearLocation: vi.fn(),
    onReload: vi.fn(),
    onGoToCurrentLocation: vi.fn(),
    onCreateSpot: vi.fn(),
    onOpenSpot: vi.fn(),
    onToggleFavorite: vi.fn(),
    onLoadMore: vi.fn(),
    onReportSpot: vi.fn(),
  }

  return mount(MobileMapOverlay, {
    props: { ...defaultProps, ...props },
    global: {
      stubs: {
        LeafletSpotMap: { template: '<div class="leaflet-map-mock" />' },
        SpotMiniCard: { template: '<div class="spot-mini-card-mock" />' },
        SearchSuggestions: {
          template: `
            <div class="search-suggestions" v-if="isOpen">
              <div class="search-suggestions__section" v-if="spotSuggestions.length">
                <button
                  v-for="spot in spotSuggestions"
                  :key="spot.id"
                  class="search-suggestions__item search-suggestions__item--spot"
                  @click="$emit('select-spot', spot)"
                >{{ spot.title }}</button>
              </div>
              <div class="search-suggestions__section" v-if="locationResults.length">
                <button 
                  v-for="result in locationResults" 
                  :key="result.id" 
                  class="search-suggestions__item"
                  @click="$emit('select-location', result)"
                >{{ result.label }}</button>
              </div>
              <div class="search-suggestions__section" v-if="activeLocation">
                <button 
                  class="search-suggestions__item search-suggestions__item--active"
                  @click="$emit('clear-location')"
                >{{ activeLocation.label }}</button>
              </div>
            </div>
          `,
          props: ['spots', 'locationResults', 'activeLocation', 'query', 'isOpen'],
          emits: ['select-spot', 'select-location', 'clear-location'],
          computed: {
            spotSuggestions() {
              const q = String(this.query || '').trim().toLowerCase()
              if (q.length < 2) return []
              const spots = Array.isArray(this.spots) ? this.spots : []
              return spots.filter((spot) => String(spot?.title || '').toLowerCase().includes(q)).slice(0, 5)
            }
          }
        },
        AppTextField: {
          template: '<input :class="className" :placeholder="placeholder" v-model="model" @focus="$emit(\'focus\')" @blur="$emit(\'blur\')" @keydown.enter="$emit(\'enter\')" />',
          props: ['modelValue', 'className', 'placeholder', 'bare'],
          emits: ['update:modelValue', 'focus', 'blur', 'enter'],
          computed: {
            model: {
              get() { return this.modelValue },
              set(val) { this.$emit('update:modelValue', val) }
            }
          }
        },
        AppCheckbox: { template: '<input type="checkbox" />' },
        ActionButton: {
          template: '<button :class="className" :aria-label="label" @click="$emit(\'click\')"><slot /></button>',
          props: ['className', 'icon', 'iconOnly', 'label', 'busy'],
          emits: ['click'],
        },
      },
    },
  })
}

describe('MobileMapOverlay Search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Search Input', () => {
    it('calls onUpdateLocationQuery when user types in search bar', async () => {
      const onUpdateLocationQuery = vi.fn()
      const wrapper = createWrapper({ onUpdateLocationQuery })

      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('Zurich HB')
      await nextTick()

      expect(onUpdateLocationQuery).toHaveBeenCalledWith('Zurich HB')
    })

    it('calls onSearchLocation when user clicks search button', async () => {
      const onSearchLocation = vi.fn(async () => {})
      const wrapper = createWrapper({ onSearchLocation })

      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('Zurich HB')
      await nextTick()

      const searchButton = wrapper.find('.fullscreen-map__search-submit')
      await searchButton.trigger('click')
      await nextTick()

      expect(onSearchLocation).toHaveBeenCalled()
    })

    it('calls onSearchLocation when user presses Enter', async () => {
      const onSearchLocation = vi.fn(async () => {})
      const wrapper = createWrapper({ onSearchLocation })

      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('Bahnhofstrasse')
      await searchInput.trigger('keydown.enter')
      await nextTick()

      expect(onSearchLocation).toHaveBeenCalled()
    })
  })

  describe('Location Results', () => {
    it('displays location search results when available', async () => {
      const mockResults = createMockLocationResults()
      const wrapper = createWrapper({ locationResults: mockResults })

      wrapper.vm.searchFocus = true
      await nextTick()

      const dropdown = wrapper.find('.search-suggestions')
      expect(dropdown.exists()).toBe(true)

      const results = wrapper.findAll('.search-suggestions__item')
      expect(results.length).toBe(2)
    })

    it('calls onSelectLocation when user clicks a location result', async () => {
      const onSelectLocation = vi.fn()
      const mockResults = createMockLocationResults()
      const wrapper = createWrapper({ locationResults: mockResults, onSelectLocation })

      wrapper.vm.searchFocus = true
      await nextTick()

      const firstResult = wrapper.find('.search-suggestions__item')
      await firstResult.trigger('click')
      await nextTick()

      expect(onSelectLocation).toHaveBeenCalledWith(mockResults[0])
    })
  })

  describe('Spot Suggestions', () => {
    it('displays matching spot suggestions when query matches spot titles', async () => {
      const wrapper = createWrapper()
      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('Alpine')
      wrapper.vm.searchFocus = true
      await nextTick()

      const spotSuggestions = wrapper.findAll('.search-suggestions__item--spot')
      expect(spotSuggestions.length).toBe(1)
      expect(spotSuggestions[0].text()).toContain('Alpine Viewpoint')
    })

    it('opens spot details when selecting a suggested spot', async () => {
      const onOpenSpot = vi.fn()
      const wrapper = createWrapper({ onOpenSpot })
      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('City')
      wrapper.vm.searchFocus = true
      await nextTick()

      const spotSuggestion = wrapper.find('.search-suggestions__item--spot')
      await spotSuggestion.trigger('click')
      await nextTick()

      expect(onOpenSpot).toHaveBeenCalledWith(expect.objectContaining({ id: 'spot-2' }))
    })
  })

  describe('Active Location', () => {
    it('shows active location badge when activeLocation is set', async () => {
      const mockLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createWrapper({ 
        activeLocation: mockLocation,
        locationResults: []
      })

      wrapper.vm.searchFocus = true
      await nextTick()

      const searchDropdown = wrapper.find('.search-suggestions')
      expect(searchDropdown.exists()).toBe(true)
      expect(searchDropdown.text()).toContain('Zurich HB')
    })

    it('calls onClearLocation when clearing active location', async () => {
      const onClearLocation = vi.fn()
      const mockLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createWrapper({ activeLocation: mockLocation, onClearLocation })

      wrapper.vm.searchFocus = true
      await nextTick()

      const clearButton = wrapper.find('.search-suggestions__item--active')
      await clearButton.trigger('click')
      await nextTick()

      expect(onClearLocation).toHaveBeenCalled()
    })
  })

  describe('Results Panel', () => {
    it('results panel is hidden by default', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.resultsPanelOpen).toBe(false)
    })

    it('opens results panel when search is submitted', async () => {
      const onSearchLocation = vi.fn(async () => {})
      const wrapper = createWrapper({ onSearchLocation })

      const searchInput = wrapper.find('.fullscreen-map__search-input')
      await searchInput.setValue('test')
      await searchInput.trigger('keydown.enter')
      await nextTick()

      expect(wrapper.vm.resultsPanelOpen).toBe(true)
    })

    it('opens results panel when location is selected', async () => {
      const onSelectLocation = vi.fn()
      const mockResults = createMockLocationResults()
      const wrapper = createWrapper({ locationResults: mockResults, onSelectLocation })

      wrapper.vm.searchFocus = true
      await nextTick()

      const firstResult = wrapper.find('.search-suggestions__item')
      await firstResult.trigger('click')
      await nextTick()

      expect(wrapper.vm.resultsPanelOpen).toBe(true)
    })
  })

  describe('Filter Panel', () => {
    it('filter panel is hidden by default', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.filterPanelOpen).toBe(false)
    })

    it('opens filter panel when filter button is clicked', async () => {
      const wrapper = createWrapper()
      const filterButton = wrapper.findAll('.fullscreen-map__toggle').at(0)
      await filterButton.trigger('click')
      await nextTick()

      expect(wrapper.vm.filterPanelOpen).toBe(true)
    })

    it('shows active filter indicator when text filter is set', async () => {
      const wrapper = createWrapper({
        filters: { text: 'test', tagsText: '', ownerText: '', visibility: 'all', onlyFavorites: false, radiusKm: 0 },
        canReset: true,
      })
      await nextTick()

      const filterToggle = wrapper.find('.fullscreen-map__toggle')
      await filterToggle.trigger('click')
      await nextTick()
      expect(filterToggle.classes()).toContain('fullscreen-map__toggle--active')
    })
  })

  describe('hasActiveFilters', () => {
    it('returns true when text filter is set', () => {
      const wrapper = createWrapper({
        filters: { text: 'test', tagsText: '', ownerText: '', visibility: 'all', onlyFavorites: false, radiusKm: 0 },
      })
      expect(wrapper.vm.hasActiveFilters).toBe(true)
    })

    it('returns true when activeLocation is set', () => {
      const mockLocation = { id: 'loc-1', label: 'Zurich', lat: 47.3782, lon: 8.5403 }
      const wrapper = createWrapper({
        activeLocation: mockLocation,
        filters: { text: '', tagsText: '', ownerText: '', visibility: 'all', onlyFavorites: false, radiusKm: 0 },
      })
      expect(wrapper.vm.hasActiveFilters).toBe(true)
    })

    it('returns false when no filters are set', () => {
      const wrapper = createWrapper({
        filters: { text: '', tagsText: '', ownerText: '', visibility: 'all', onlyFavorites: false, radiusKm: 0 },
        activeLocation: null,
      })
      expect(wrapper.vm.hasActiveFilters).toBe(false)
    })
  })

  describe('Toolbar Actions', () => {
    it('has current location button that triggers onGoToCurrentLocation', async () => {
      const onGoToCurrentLocation = vi.fn()
      const wrapper = createWrapper({ onGoToCurrentLocation })

      const button = wrapper.find('[aria-label="Current location"]')
      await button.trigger('click')
      await nextTick()

      expect(onGoToCurrentLocation).toHaveBeenCalled()
    })

    it('has create spot button that triggers onCreateSpot', async () => {
      const onCreateSpot = vi.fn()
      const wrapper = createWrapper({ onCreateSpot })

      const button = wrapper.find('[aria-label="New spot"]')
      await button.trigger('click')
      await nextTick()

      expect(onCreateSpot).toHaveBeenCalled()
    })

    it('has reload button that triggers onReload', async () => {
      const onReload = vi.fn()
      const wrapper = createWrapper({ onReload })

      const button = wrapper.find('[aria-label="Reload"]')
      await button.trigger('click')
      await nextTick()

      expect(onReload).toHaveBeenCalled()
    })
  })
})
