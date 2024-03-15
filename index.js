import algoliasearch from 'algoliasearch/lite';
import { autocomplete, getAlgoliaResults } from '@algolia/autocomplete-js';
import { createQuerySuggestionsPlugin } from '@algolia/autocomplete-plugin-query-suggestions';
import { createLocalStorageRecentSearchesPlugin } from '@algolia/autocomplete-plugin-recent-searches';

import historyRouter from 'instantsearch.js/es/lib/routers/history';
import instantsearch from 'instantsearch.js';
import { connectSearchBox } from 'instantsearch.js/es/connectors';
import { hierarchicalMenu, hits, pagination } from 'instantsearch.js/es/widgets';


import '@algolia/autocomplete-theme-classic';

const searchClient = algoliasearch(
  'ABYDI81FVI',
  '10b4ccf9eba6e1ac15eb6c0fbfffd404',
);
const INSTANT_SEARCH_INDEX_NAME = 'ecommerce_data';
const instantSearchRouter = historyRouter();


// Build URLs that InstantSearch understands.
function getInstantSearchUrl(indexUiState) {
  return search.createURL({ [INSTANT_SEARCH_INDEX_NAME]: indexUiState });
}

// Detect when an event is modified with a special key to let the browser
// trigger its default behavior.
function isModifierEvent(event) {
  const isMiddleClick = event.button === 1;

  return (
    isMiddleClick ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  );
}

function onSelect({ setIsOpen, setQuery, event, query }) {
  // You want to trigger the default browser behavior if the event is modified.
  if (isModifierEvent(event)) {
    return;
  }

  setQuery(query);
  setIsOpen(false);
  setInstantSearchUiState({ query });
}

function getItemUrl({ query }) {
  return getInstantSearchUrl({ query });
}

function createItemWrapperTemplate({ children, query, html }) {
  const uiState = { query };

  return html`<a
    class="aa-ItemLink"
    href="${getInstantSearchUrl(uiState)}"
    onClick="${(event) => {
      if (!isModifierEvent(event)) {
        // Bypass the original link behavior if there's no event modifier
        // to set the InstantSearch UI state without reloading the page.
        event.preventDefault();
      }
    }}"
  >
    ${children}
  </a>`;
}

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
  key: 'instantsearch',
  limit: 3,
  transformSource({ source }) {
    return {
      ...source,
      getItemUrl({ item }) {
        return getItemUrl({
          query: item.label,
        });
      },
      onSelect({ setIsOpen, setQuery, item, event }) {
        onSelect({
          setQuery,
          setIsOpen,
          event,
          query: item.label,
        });
      },
      // Update the default `item` template to wrap it with a link
      // and plug it to the InstantSearch router.
      templates: {
        ...source.templates,
        item(params) {
          const { children } = source.templates.item(params).props;

          return createItemWrapperTemplate({
            query: params.item.label,
            children,
            html: params.html,
          });
        },
      },
    };
  },
});



// query suggestions

const querySuggestionsPlugin = createQuerySuggestionsPlugin({
  searchClient,
  indexName: 'demo_query_suggestions',
  getSearchParams() {
    return {
      hitsPerPage: 3,
    };
  },
  categoryAttribute: [
    'instant_search',
    'facets',
    'exact_matches',
    'categories',
    'brands',
  ],
  itemsWithCategories: 1,
  categoriesPerItem: 2,
  });

const search = instantsearch({
  indexName: INSTANT_SEARCH_INDEX_NAME,
  searchClient,
  routing: instantSearchRouter,
});

// Mount a virtual search box to manipulate InstantSearch's `query` UI
// state parameter.
const virtualSearchBox = connectSearchBox(() => {});

search.addWidgets([
  virtualSearchBox({}),
  hierarchicalMenu({
    container: '#categories',
    attributes: ['hierarchicalCategories.lvl0', 'hierarchicalCategories.lvl1', 'brand'],
  }),
  hits({
    container: '#hits',
    templates: {
      item: (hit, { html, components, sendEvent }) => html`
        <div>
          <img src="${hit.image}" align="left" alt="${hit.name}" />
          <div onclick="${() => sendEvent('click', hit, 'my-click-event')}" class="hit-name">
            ${components.Highlight({ hit, attribute: 'name' })}
            ${console.log('test event')}
          </div>
          <div  onclick="${() =>
            sendEvent('conversion', hit, 'my-conversion-event')}" class="hit-description">
            ${components.Highlight({ hit, attribute: 'description' })}
          </div>
          <div class="hit-price">$${hit.price}</div>
        </div>
      `,
    },
  }),
  pagination({
    container: '#pagination',
  }),
]);


search.start();


// Set the InstantSearch index UI state from external events.
function setInstantSearchUiState(indexUiState) {
  search.setUiState(uiState => ({
    ...uiState,
    [INSTANT_SEARCH_INDEX_NAME]: {
      ...uiState[INSTANT_SEARCH_INDEX_NAME],
      // We reset the page when the search state changes.
      page: 1,
      ...indexUiState,
    },
  }));
}

// Return the InstantSearch index UI state.
function getInstantSearchUiState() {
  const uiState = instantSearchRouter.read();

  return (uiState && uiState[INSTANT_SEARCH_INDEX_NAME]) || {};
}

const searchPageState = getInstantSearchUiState();

let skipInstantSearchUiStateUpdate = false;


const { setQuery } = autocomplete({
  container: '#autocomplete',
  placeholder: 'Search for products',
  openOnFocus: true,
  detachedMediaQuery: 'none',
  insights: true,
  plugins: [recentSearchesPlugin, querySuggestionsPlugin],
  initialState: {
    query: searchPageState.query || '',
  },
  onSubmit({ state }) {
    setInstantSearchUiState({ query: state.query });
  },
  onReset() {
    setInstantSearchUiState({ query: '' });
  },
  onStateChange({ prevState, state }) {
    if (!skipInstantSearchUiStateUpdate && prevState.query !== state.query) {
      setInstantSearchUiState({ query: state.query });
    }
    skipInstantSearchUiStateUpdate = false;
  },
  getSources({ query }) {
    return [
      {
        sourceId: 'products',
        getItems() {
          return getAlgoliaResults({
            searchClient,
            queries: [
              {
                indexName: 'ecommerce_data',
                query,
                params: {
                  hitsPerPage: 5,
                  attributesToSnippet: ['name:10', 'description:35'],
                  snippetEllipsisText: '…',
                },
              },
            ],
          });
        },
        templates: {
          item({ item, components, html }) {
            return html`<div class="aa-ItemWrapper">
              <div class="aa-ItemContent">
                <div class="aa-ItemIcon aa-ItemIcon--alignTop">
                  <img
                    src="${item.image}"
                    alt="${item.name}"
                    width="40"
                    height="40"
                  />
                </div>
                <div class="aa-ItemContentBody">
                  <div class="aa-ItemContentTitle">
                    ${components.Highlight({
                      hit: item,
                      attribute: 'name',
                    })}
                  </div>
                  <div class="aa-ItemContentDescription">
                    ${components.Snippet({
                      hit: item,
                      attribute: 'description',
                    })}
                  </div>
                </div>
                <div class="aa-ItemActions">
                  <button
                    class="aa-ItemActionButton aa-DesktopOnly aa-ActiveOnly"
                    type="button"
                    title="Select"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="currentColor"
                    >
                      <path
                        d="M18.984 6.984h2.016v6h-15.188l3.609 3.609-1.406 1.406-6-6 6-6 1.406 1.406-3.609 3.609h13.172v-4.031z"
                      />
                    </svg>
                  </button>
                  <button
                    class="aa-ItemActionButton"
                    type="button"
                    title="Add to cart"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="currentColor"
                    >
                      <path
                        d="M19 5h-14l1.5-2h11zM21.794 5.392l-2.994-3.992c-0.196-0.261-0.494-0.399-0.8-0.4h-12c-0.326 0-0.616 0.156-0.8 0.4l-2.994 3.992c-0.043 0.056-0.081 0.117-0.111 0.182-0.065 0.137-0.096 0.283-0.095 0.426v14c0 0.828 0.337 1.58 0.879 2.121s1.293 0.879 2.121 0.879h14c0.828 0 1.58-0.337 2.121-0.879s0.879-1.293 0.879-2.121v-14c0-0.219-0.071-0.422-0.189-0.585-0.004-0.005-0.007-0.010-0.011-0.015zM4 7h16v13c0 0.276-0.111 0.525-0.293 0.707s-0.431 0.293-0.707 0.293h-14c-0.276 0-0.525-0.111-0.707-0.293s-0.293-0.431-0.293-0.707zM15 10c0 0.829-0.335 1.577-0.879 2.121s-1.292 0.879-2.121 0.879-1.577-0.335-2.121-0.879-0.879-1.292-0.879-2.121c0-0.552-0.448-1-1-1s-1 0.448-1 1c0 1.38 0.561 2.632 1.464 3.536s2.156 1.464 3.536 1.464 2.632-0.561 3.536-1.464 1.464-2.156 1.464-3.536c0-0.552-0.448-1-1-1s-1 0.448-1 1z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>`;
          },
        },
        getItemUrl({ item }) {
          return item.url;
        },  
      },
    ];
  },
})

// This keeps Autocomplete aware of state changes coming from routing
// and updates its query accordingly
window.addEventListener('popstate', () => {
  skipInstantSearchUiStateUpdate = true;
  setQuery(search.helper?.state.query || '');
});

