import React, { useState, useEffect } from 'react';
// import { Navbar, Nav } from 'react-bootstrap';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'
import firebase from 'firebase/app';
import 'firebase/database';
import './css/TeachingResources.scss';
// import Containerfull from '../fragment/Containerfull';
// import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function TeachingResources() {

    const [expandedItems, setExpandedItems] = useState({});

    // Function to toggle the expansion state for a specific item
    const toggleExpansion = (index) => {
        setExpandedItems((prevExpandedItems) => ({
            ...prevExpandedItems,
            [index]: !prevExpandedItems[index],
        }));
    };
    const initialFilterOptions = {
        date: '',
        school: '',
        month: '',
        year: '',
        hasOutline: false, // Assuming it's a checkbox
    };

    const [filterOptions, setFilterOptions] = useState(initialFilterOptions);

    const resetFilter = () => {
        // Reset filterOptions to the initial values
        setFilterOptions(initialFilterOptions);
    };
    const [showFilter, setShowFilter] = useState(false);

    const toggleFilter = () => {
        setShowFilter(!showFilter);
    };

    const userId = localStorage.getItem('ae-useruid');
    const teacherschool = localStorage.getItem('ae-teacherschool');
    const teacher = localStorage.getItem('ae-username');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const uniqueId = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}-${userId}`; // Create a unique ID

    const [currentDateTime, setCurrentDateTime] = useState({});
    const [isPopupOpen, setPopupOpen] = useState(false);
    const openPopup = () => {
        setPopupOpen(true);
    };

    const closePopup = () => {
        setPopupOpen(false);
    };
    const [isLoading, setLoading] = useState(true);

    const [text, setText] = useState('');


    const [error, setError] = useState(true);
    // const [data, setData] = useState([]);
    const data = JSON.parse(localStorage.getItem('teachingResourcesData'));


    useEffect(() => {
        setTimeout(() => {
            setLoading(false);
        }, 2000);
    }, []);

    useEffect(() => {
        const formattedDateTime = `${year},${month},${day} ${hours}:${minutes}:${seconds}`;
        setCurrentDateTime(formattedDateTime);
    }, [day, hours, minutes, month, seconds, year]);

    const handleChange = (e) => {
        const newText = e.target.value;
        setText(newText);

        // Check if the textarea is empty
        if (newText.trim() === '') {
            setError(true);
        } else {
            setError(false);
        }
    }
    const isSubmitDisabled = text.length < 10;

    const handleSubmit = () => {
        if (window.confirm('確定要上傳嗎?')) {
            const postData = {
                timestamp: currentDateTime,
                school: teacherschool,
                teacher: teacher,
                text: text,
                likes: 0,
            };
            // Use `push` to generate a unique ID for each submission
            const newPostRef = firebase.database().ref('TeachingResources/').push();
            const postkey = newPostRef.key;
            console.log(newPostRef.key)
            newPostRef.set({
                ...postData,
                postkey: postkey,
                date: uniqueId,
            });
            closePopup();
        }
    };
    const [editData, setEditData] = useState(null);
    const handleEdit = (item) => {
        // Only allow users to edit their own posts
        if (item.date.endsWith(`-${userId}`)) {
            setEditData(item);
        } else {
            alert('You can only edit your own posts.');
        }
    };

    const handleSaveEdit = () => {
        if (editData) {
            // Update the edited data in Firebase
            const postRef = firebase.database().ref('TeachingResources/' + editData.postkey);
            // Capture the current timestamp
            const updatedTimestamp = currentDateTime;
            // Update the 'text' and 'timestamp' fields with the edited content and the new timestamp
            postRef.update({
                text: editData.text,
                updatedTimestamp: updatedTimestamp,
            });
            // Clear the editData state to exit edit mode
            setEditData(null);
        }
    };

    const handleCancelEdit = () => {
        // Reset the editData state to cancel the edit
        setEditData(null);
    };

    const handleDelete = (item) => {
        if (window.confirm("Are you sure you want to delete this post?")) {
            const postRef = firebase.database().ref('TeachingResources/' + item.postkey);
            postRef.remove()
                .then(() => {
                    alert("Post deleted successfully.");
                })
                .catch((error) => {
                    console.error("Error deleting post: " + error);
                });
            window.location.reload();
        }
    };

    // const success = () => {
    //     toast.success('已加入收藏', {
    //         className: "notification",
    //         position: "top-center",
    //         autoClose: 3000,
    //         hideProgressBar: false,
    //         closeOnClick: true,
    //         pauseOnHover: false,
    //         draggable: true,
    //         progress: undefined,
    //         theme: "colored",
    //     });
    // }


    // const [isHeartActive, setHeartActive] = useState(false);

    // const handleClick = () => {
    //     setHeartActive(!isHeartActive);
    // };



    return (
        // <Containerfull>
        <div className='teaching-container'>
            <div className='teaching-filter-container'>
                <button className='teaching-filter-btn' onClick={toggleFilter}>
                    {showFilter ? '❌關閉' : '🗂️篩選器'}</button>
                <button className='popupbtn' onClick={openPopup}>➕ 新增教學資源</button>
            </div>
            {
                showFilter && (
                    <div className='teaching-filter'>
                        <label>
                            日期查詢
                            <input
                                value={filterOptions.date}
                                onChange={(e) => setFilterOptions({ ...filterOptions, date: e.target.value })}
                                placeholder='請輸入日期' />
                        </label>

                        <label>
                            校區
                            <select
                                value={filterOptions.school}
                                onChange={(e) => setFilterOptions({ ...filterOptions, school: e.target.value })}
                            >
                                <option value="" >顯示全部</option>
                                <option value="桃園校區">桃園校區</option>
                                <option value="龜山校區">龜山校區</option>

                                {/* Add school options */}
                            </select>
                        </label>

                        <label>
                            月份
                            <select
                                value={filterOptions.month}
                                onChange={(e) => setFilterOptions({ ...filterOptions, month: e.target.value })}
                            >
                                <option value="">顯示全部</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                                <option value="11">11</option>
                                <option value="12">12</option>
                                {/* Add month options */}
                            </select>
                        </label>

                        <label>
                            年份
                            <select
                                value={filterOptions.year}
                                onChange={(e) => setFilterOptions({ ...filterOptions, year: e.target.value })}
                            >
                                <option value="">顯示全部</option>
                                <option value="2023">2023</option>
                                <option value="2022">2022</option>
                                <option value="2021">2021</option>
                                {/* Add year options */}
                            </select>
                        </label>

                        <label>
                            <input
                                value={filterOptions.hasOutline}
                                type="checkbox"
                                onChange={(e) => setFilterOptions({ ...filterOptions, hasOutline: e.target.checked })}
                            /> 只顯示我的貼文
                        </label>
                        <button className='reset-filter-btn' onClick={resetFilter}>重置篩選</button>
                    </div>
                )
            }

            {/* <div className='teaching-sidebar'>
                <Navbar bg="light" expand="lg" className="sidebar">
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="flex-column">
                            <Nav.Link onClick={() => handleNavLinkClick('課程內容')}>課程內容</Nav.Link>
                            <Nav.Link onClick={() => handleNavLinkClick('教學方法')}>教學方法</Nav.Link>
                            <Nav.Link onClick={() => handleNavLinkClick('導師留言')}>導師留言</Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Navbar>
            </div> */}
            <div className='teaching-main'>
                {
                    data.length ? (
                        data
                            .filter((item) => {
                                // Date filter
                                if (filterOptions.date && !item.date.slice(0, -38).includes(filterOptions.date)) {
                                    return false;
                                }

                                // School filter
                                if (filterOptions.school && !item.school.includes(filterOptions.school)) {
                                    return false;
                                }

                                // Month filter
                                if (filterOptions.month && parseInt(item.date.slice(5, 7)) !== parseInt(filterOptions.month)) {
                                    return false;
                                }

                                // Year filter
                                if (filterOptions.year && parseInt(item.date.slice(0, 4)) !== parseInt(filterOptions.year)) {
                                    return false;
                                }

                                // Has Outline filter
                                if (filterOptions.hasOutline && !item.date.endsWith(`-${userId}`)) {
                                    return false;
                                }

                                return true;
                            })
                            .reverse()
                            .map((item, index) => (
                                <div div key={index} className={item.date.endsWith(`-${userId}`) ? 'data-box-outline' : 'data-box'}>
                                    <div>
                                        貼文日期: {item.date.slice(0, 19)}
                                        <div className='edittimestamp'>
                                            {item.updatedTimestamp ? `${item.updatedTimestamp}編輯過` : ''}
                                        </div>
                                    </div>
                                    <div>分校: {item.school}</div>
                                    <div>老師: {item.teacher.toUpperCase()}</div>
                                    <div>
                                        <div>內容:
                                            {editData && editData.date === item.date ? (
                                                // Edit input
                                                <div>
                                                    <textarea
                                                        type="text"
                                                        value={editData.text}
                                                        onChange={(e) => setEditData({ ...editData, text: e.target.value })}
                                                        className='editinput'
                                                        rows="4"
                                                        cols="28"
                                                    />
                                                </div>
                                            ) : (
                                                // Display post content
                                                <div className="cutoff-text" style={{ maxHeight: expandedItems[index] ? 'none' : '3em', overflow: 'hidden' }}>
                                                    {item.text}
                                                </div>
                                            )}
                                            <div className='expandbtn-container'>
                                                <button className='expandbtn' onClick={() => toggleExpansion(index)}>
                                                    {expandedItems[index] ? '隱藏全文' : '查看全文'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='button-container'>
                                        {/* <ToastContainer /> */}
                                        {/* <div className="heart-btn">
                                            <div className={`content ${isHeartActive ? 'heart-active' : ''}`} onClick={handleClick}>
                                                <div className={`text ${isHeartActive ? 'heart-active' : ''}`}>
                                                </div>
                                                <div className={`numb ${isHeartActive ? 'heart-active' : ''}`}>
                                                </div>
                                                <div className={`heart ${isHeartActive ? 'heart-active' : ''}`}>
                                                </div>
                                            </div>
                                        </div> */}
                                        {/* <div className="heart-btn">
                                                <div className="content">
                                                    <span className="heart"></span>
                                                    <span className="text">Like</span>
                                                    <span className="numb"></span>
                                                </div>
                                            </div> */}
                                        <button>❤️{item.likes || 0}</button>
                                        {item.date.endsWith(`-${userId}`) && (
                                            editData && editData.date === item.date ? (
                                                // Edit buttons
                                                <div className='buttons'>
                                                    <button className='saveeditbtn' onClick={handleSaveEdit}>Save</button>
                                                    <button className='cancel-edit-button' onClick={() => handleCancelEdit()}>取消</button>
                                                </div>
                                            ) : (
                                                // Normal buttons
                                                <div className='buttons'>

                                                    <button className='posteditbtn' onClick={() => handleEdit(item)}>Edit</button>
                                                    {item.date.endsWith(`-${userId}`) && (
                                                        <button className='deletebtn' onClick={() => handleDelete(item)}>Delete</button>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            ))
                    ) : (
                        <div className='loader'>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                            </div>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                                <div className='button-container'>

                                </div>
                            </div>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                                <div className='button-container'>

                                </div>
                            </div>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                                <div className='button-container'>

                                </div>
                            </div>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                                <div className='button-container'>

                                </div>
                            </div>
                            <div className='data-box'>
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Date:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            School:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Teacher:
                                        </div>

                                    )
                                }
                                {
                                    isLoading ? (
                                        <Skeleton />
                                    ) : (
                                        <div>
                                            Text:
                                        </div>

                                    )
                                }
                                <div className='button-container'>

                                </div>
                            </div>
                        </div>
                    )
                }
                {isPopupOpen && (
                    <>
                        <div className='Overlay' />
                        <div className='form-box'>
                            <div className='form-box-title'>新增教學資源</div>
                            <div>
                                <label>AlanEnglish校區 : {teacherschool}</label>
                            </div>
                            <div>
                                <label>老師名稱 : {teacher.toUpperCase()}</label>
                            </div>
                            <div>
                                <label>內容 :</label>
                                <textarea
                                    value={text}
                                    onChange={handleChange}
                                    rows="4"
                                    cols="22"
                                ></textarea>
                                {error && <p style={{ color: 'red' }}>字數至少10個字</p>}
                            </div>
                            <div className='btncontainer'>
                                <button className='teachingsubmitbtn' type='submit' onClick={handleSubmit} disabled={isSubmitDisabled}>上傳</button>
                                <button className='teachingclosebtn' onClick={closePopup}>取消</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
        // </Containerfull >
    );
}

export default TeachingResources;
