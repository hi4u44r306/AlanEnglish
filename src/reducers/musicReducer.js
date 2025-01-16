// Constants for action types
export const SET_PLAY_PAUSE_STATUS = "SET_PLAY_PAUSE_STATUS";
export const SET_CURR_PLAYING = "SET_CURR_PLAYING";
export const SET_BANNER_OPEN = "SET_BANNER_OPEN";
export const SET_SEARCH_QUERY = "SET_SEARCH_QUERY";
export const SET_MUSIC_LIST = "SET_MUSIC_LIST";
export const SET_CURR_MARGIN = "SET_CURR_MARGIN";
export const SET_NO_INTERACTION_COUNT = "SET_NO_INTERACTION_COUNT";


// Initial state for the reducer
export const initialState = {
    playing: null,
    bannerOpen: false,
    search: null,
    language: null,
    curr_margin: 0,
    playingStatus: false,
    noInteractionCount: 0,
};

// Reducer function
function musicReducer(state = initialState, action) {
    switch (action.type) {
        case SET_NO_INTERACTION_COUNT:
            return {
                ...state,
                noInteractionCount: action.payload
            };
        case SET_PLAY_PAUSE_STATUS:
            return {
                ...state,
                playingStatus: action.payload,
            };

        case SET_CURR_PLAYING:
            return {
                ...state,
                playing: action.payload,
            };

        case SET_BANNER_OPEN:
            return {
                ...state,
                bannerOpen: action.payload,
            };

        case SET_SEARCH_QUERY:
            return {
                ...state,
                search: action.payload,
            };

        case SET_MUSIC_LIST:
            return {
                ...state,
                language: action.payload,
            };

        case SET_CURR_MARGIN:
            return {
                ...state,
                curr_margin: action.payload,
            };

        default:
            return state;
    }
};

export default musicReducer;
