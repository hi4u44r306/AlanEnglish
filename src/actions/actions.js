export const setNoInteractionCount = (count) => ({
    type: 'SET_NO_INTERACTION_COUNT',
    payload: count,
});
export const setPlayPauseStatus = (status) => {
    return {
        type: "SET_PLAY_PAUSE_STATUS",
        payload: status
    };
};
export const setCurrentPlaying = (curr_music) => {
    return {
        type: "SET_CURR_PLAYING",
        payload: curr_music
    };
}
export const setCurrentMargin = (curr_margin) => {
    return {
        type: "SET_CURR_MARGIN",
        payload: curr_margin
    };
}
export const setBannerOpen = (isOpen) => {
    return {
        type: "SET_BANNER_OPEN",
        payload: isOpen
    };
};

export const increaseTimesPlayed = (id) => {
    return {
        type: "INC_TIMES_PLAYED",
        payload: id
    };
};

export const setSearch = (searchQuery) => {
    return {
        type: "SET_SEARCH_QUERY",
        payload: searchQuery
    };
};

export const setMusicLang = (langList) => {
    return {
        type: "SET_MUSIC_LIST",
        payload: langList
    };
};