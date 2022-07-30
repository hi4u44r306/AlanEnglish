import React, { useRef, useState} from "react";
import '../assets/scss/SearchBar.scss';
import {useDispatch} from "react-redux";
import {setSearch} from "../../actions/actions";
import {Link} from "react-router-dom";
import Form from 'react-bootstrap/Form';

const SearchBar = () => {
    // const [isSearchBarOpen, setSearchBarOpen] = useState(false);
    // const handleSearchBarOpen = () => {
    //     setSearchBarOpen(!isSearchBarOpen);
    // };
    const [searchQuery, setSearchQuery] = useState("");
    const handleSearchQuery = (e) => {
        setSearchQuery(e.target.value);
    };
    const searchRef = useRef();
    // useEffect(() => {
    //     if (isSearchBarOpen === true) {
    //         searchRef.current.focus();
    //     }
    // });

    const dispatch = useDispatch();
    const searchLink = useRef();
    const handleSearch = (e) => {
        e.preventDefault();
        dispatch(setSearch(searchQuery.toLowerCase()));
        if (searchQuery !== "")
            searchLink.current.click();
    };

    return (
        <div >
            <form onSubmit={handleSearch} className={"search-container"}>
                {/* {
                    isSearchBarOpen &&
                    <>
                        <Link to={"/home/search"} ref={searchLink}/>
                        <SearchSharpIcon  className="search-icon" fontSize="small"/>
                        <input id={"search-input"}
                               name={"searchQuery"}
                               value={searchQuery}
                               onChange={handleSearchQuery}
                               placeholder={"搜尋音軌..."}
                               type="text"
                               ref={searchRef}
                               className="me-2 my-2"
                        />
                        <Form.Control
                            id={"search-input"}
                            name={"searchQuery"}
                            value={searchQuery}
                            onChange={handleSearchQuery}
                            ref={searchRef}
                            type="search"
                            placeholder="搜尋音軌..."
                            className="me-2 my-2"
                            aria-label="Search"
                        />
                        
                    </>
                } */}
                <Link to={"/home/search"} ref={searchLink}/>
                        <Form.Control
                            id={"search-input"}
                            name={"searchQuery"}
                            value={searchQuery}
                            onChange={handleSearchQuery}
                            ref={searchRef}
                            type="search"
                            placeholder="搜尋音軌..."
                            className="searchbar"
                            aria-label="Search"
                        />
            </form>
            {/* {
                !isSearchBarOpen &&
                <div className={"SearchBar-customPlaceholderOpen"}
                     onClick={handleSearchBarOpen}>
                    <SearchSharpIcon sclassName="search-icon" fontSize="small"/>
                    <p className={"hide"}>&nbsp;搜尋音軌</p>
                </div>
            }
            {
                isSearchBarOpen &&
                <div className={"SearchBar-customPlaceholderClose"}
                     onClick={handleSearchBarOpen}>
                    
                    <p>Close&nbsp;</p>
                    <CancelIcon className="cancel hide" fontSize="small"/>
                </div>
            } */}


        </div>
    );
};

export default SearchBar;