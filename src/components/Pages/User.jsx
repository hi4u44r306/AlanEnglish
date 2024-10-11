// import React, { useEffect, useState } from 'react';
// import './css/User.scss';
// import Logout from './Logout'
// // import HashLoader from "react-spinners/HashLoader";
// // import UserImage1 from "../assets/img/User-Image1.png";
// // import UserImage2 from "../assets/img/Login.png";
// import 'react-circular-progressbar/dist/styles.css';
// import { ToastContainer } from "react-toastify"
// import { rtdb } from './firebase-config';
// import { child, onValue, ref } from 'firebase/database';


// const User = () => {

//     // const username = localStorage.getItem('ae-username');
//     // const classname = localStorage.getItem('ae-class');
//     const Month = new Date().toJSON().slice(5, 7);
//     const [dayplaytime, setDayPlayTime] = useState();
//     const [monthplaytime, setMonthPlayTime] = useState();
//     const [classname, setClassname] = useState();
//     const [username, setUsername] = useState();
//     const [musicpass, setMusicPass] = useState();
//     const useruid = localStorage.getItem('ae-useruid');
//     const dbRef = ref(rtdb);
//     const musicplayRef = child(dbRef, `student/${useruid}`);
//     const musicpassRef = child(dbRef, `student/${useruid}/MusicLogfile`);

//     useEffect(() => {
//         onValue(musicplayRef, (snapshot) => {
//             if (snapshot.exists()) {
//                 setDayPlayTime(snapshot.val().Daytotaltimeplayed);
//                 setMonthPlayTime(snapshot.val().Monthtotaltimeplayed);
//                 setClassname(snapshot.val().class);
//                 setUsername(snapshot.val().name.toUpperCase());
//             } else {
//                 setDayPlayTime(); // If data doesn't exist, setComplete to its default value
//             }
//         }, (error) => {
//             console.error("Error fetching complete value:", error);
//         });

//         onValue(musicpassRef, (snapshot) => {
//             if (snapshot.exists()) {
//                 setMusicPass(snapshot.val());
//             } else {
//                 setMusicPass(); // If data doesn't exist, setComplete to its default value
//             }
//         }, (error) => {
//             console.error("Error fetching complete value:", error);
//         });

//     }, [musicplayRef, musicpassRef])

//     // const [image, setImage] = useState();
//     // const [uploading, setUploading] = useState(false);
//     // const [data, setData] = useState();

//     // useEffect(() => {
//     //     getUserInfo();
//     // }, []);

//     // const getUserInfo = async () => {
//     //     try {
//     //         const userRef = ref(rtdb, 'student/' + await localStorage.getItem('ae-userimage') + '/userimage');
//     //         const snapshot = await get(userRef);
//     //         const data = snapshot.val();
//     //         setData(data)
//     //         const storageRef = storageref(getstorage, `UserimageFile/${data}`);
//     //         const downloadURL = await getDownloadURL(storageRef);
//     //         setImage(downloadURL);

//     //     } catch (error) {
//     //         alert('Error fetching user info:', error);
//     //     }
//     // };

//     // // Function to handle choosing an image
//     // const handleChooseImage = async () => {
//     //     try {
//     //         // Open image picker
//     //         let result = await ImagePicker.launchImageLibraryAsync({
//     //             mediaTypes: ImagePicker.MediaTypeOptions.Images,
//     //             allowsEditing: true,
//     //             aspect: [4, 3],
//     //             quality: 1,
//     //         });

//     //         // Check if image was picked
//     //         if (!result.canceled) {
//     //             // Image URI
//     //             const imageUri = result.assets[0].uri;

//     //             // Upload the image to Firebase Storage
//     //             await handleImageUpload(imageUri);
//     //         }
//     //     } catch (error) {
//     //         console.error('Error choosing image:', error);
//     //     }
//     // };


//     // // Function to handle image upload
//     // const handleImageUpload = async (imageUri) => {
//     //     setUploading(true);
//     //     try {
//     //         // Create a reference to the file to delete
//     //         const desertRef = ref(getstorage, `UserimageFile/${data}`);
//     //         // Delete the file
//     //         deleteObject(desertRef).then(() => {
//     //             alert('deleted successfully')
//     //         }).catch((error) => {

//     //         });
//     //     } catch (e) {

//     //     }
//     //     try {
//     //         const storage = getStorage();
//     //         const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1); // Corrected
//     //         const storageRef = storageref(storage, `UserimageFile/${filename}`);
//     //         const response = await fetch(imageUri);
//     //         const blob = await response.blob();
//     //         const db = getDatabase();
//     //         await update(ref(db, 'student/' + useruid), {
//     //             userimage: filename,
//     //         });
//     //         await uploadBytes(storageRef, blob);
//     //         Alert.alert('Success', 'Image uploaded successfully');
//     //         getUserInfo();
//     //     } catch (error) {
//     //         console.error('Error uploading image:', error);
//     //         Alert.alert('Error', 'Failed to upload image');
//     //     } finally {
//     //         setUploading(false);
//     //     }
//     // };


//     return (
//         <div className='User'>
//             <div className="User-profile">
//                 <div className='Userbackgroundimage'></div>
//                 <div className="User-profileDetails">
//                     <div className='User-profile-title'>
//                         PROFILE
//                     </div>
//                     {/* <div style={styles.titleContainer}>

//                         <div style={{
//                             backgroundColor: 'white',
//                             top: 20,
//                         }}>
//                             {
//                                 image ?
//                                     (
//                                         <img source={{ uri: image }} alt={image} style={{
//                                             width: 150,
//                                             height: 150,
//                                             borderRadius: 100,
//                                         }} />
//                                     ) : (
//                                         <div>Loading...</div>
//                                     )
//                             }
//                             <Button onPress={handleChooseImage} disabled={uploading} style={{
//                                 backgroundColor: '#2d7dd2',
//                                 padding: 10,
//                                 borderRadius: 10,
//                                 position: 'absolute',
//                                 right: 0,
//                                 bottom: 0,
//                             }}>
//                                 <FiEdit size={20} color={'white'} />
//                             </Button>
//                         </div>
//                         {uploading && <div style={{ justifyContent: 'center', alignContent: 'center', alignItems: 'center', marginTop: 50 }}>上傳中...</div>}
//                     </div> */}
//                     {/* <div className='dailycirclecontainer'>
//                         <span className='howtouseicon'>
//                             <img
//                                 style={{ width: 30, marginTop: -5 }}
//                                 src={Notice}
//                                 alt="notice"
//                             />
//                             <span className='howtouseicontext'>每天至少聽20次，聽一次加一顆星</span>
//                         </span>
//                         <div className='currentdaycircle'>
//                             <CircularProgressbarWithChildren value={percentage || 'Loading...'}
//                                 styles={buildStyles({
//                                     textColor: "red",
//                                     pathColor: "gold",
//                                     trailColor: `${custompathColor}`
//                                 })}
//                             >
//                                 <img
//                                     style={{ width: 40, marginTop: -5 }}
//                                     src={Star}
//                                     alt="star"
//                                 />
//                                 <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}> X {dailytimeplayed || '0'} </div>
//                             </CircularProgressbarWithChildren>
//                         </div>
//                         <div className='abc'>
//                             <div className='dailycircletext'>
//                                 <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}>{dailytimeplayed || '0'} </div>
//                                 <div className='dailycircletext2'>/ 20 次</div>
//                             </div>
//                             <div className='dailycircletext'>
//                                 <div className={dailytimeplayed >= 20 ? "complete" : 'notcomplete'}>達成目標!!!</div>
//                             </div>
//                         </div>
//                     </div> */}

//                     <div className="titleText">{username || 'NONE'}</div>
//                     <div className="userInfoContainer">
//                         <div>
//                             <div className='userinfo'>
//                                 <div className='userinfolabel'>班級</div>
//                                 <div className='secondtitleText' >{classname || ''} 班</div>
//                             </div>
//                             <div className='userinfo'>
//                                 <div className='userinfolabel'>{Month} 月聽力次數 </div>
//                                 <div className='secondtitleText'>{monthplaytime || '0'} 次</div>
//                             </div>
//                             <div className='userinfo'>
//                                 <div className='userinfolabel'>今日聽力次數 </div>
//                                 <div className='secondtitleText'>{dayplaytime || '0'} 次</div>
//                             </div>
//                         </div>
//                     </div>

//                     <Logout />

//                     <div>
//                         <div>
//                             已通過的項目
//                         </div>
//                         <div>
//                             {musicpass && Object.keys(musicpass).length > 0 ? (
//                                 <ul>
//                                     {Object.entries(musicpass).map(([key, value]) => (
//                                         <li key={key}>
//                                             <strong>{key}</strong>: 完成狀態 - {value.complete}, 音樂播放次數 - {value.musicplay}
//                                         </li>
//                                     ))}
//                                 </ul>
//                             ) : (
//                                 <p>No data available.</p>
//                             )}
//                         </div>
//                     </div>

//                     <ToastContainer
//                         position="top-center"
//                         autoClose={2000}
//                         hideProgressBar={false}
//                         newestOnTop={false}
//                         closeOnClick
//                         rtl={false}
//                         pauseOnFocusLoss
//                         draggable
//                         pauseOnHover
//                     />
//                     {/* <div>Days Learned</div> */}
//                     {/* <div className='dailycirclecontainer'>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                     <div className='dailycircletext'>Mon</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Tue</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Wed</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Thur</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Fri</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Sat</div>
//                     </div>
//                     <div className='dailycircle'>
//                         <CircularProgressbar
//                             value={percentage || ''}
//                             text={`${percentage || '0'}%`}
//                             styles={buildStyles({
//                             textColor: "red",
//                             pathColor: {custompathColor},
//                             trailColor: "gold"
//                             })}
//                         />
//                         <div className='dailycircletext'>Sun</div>
//                     </div>

//                 </div> */}
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default User





import React, { useEffect, useState } from 'react';
import './css/User.scss';
import Logout from './Logout';
import 'react-circular-progressbar/dist/styles.css';
import { ToastContainer } from "react-toastify";
import { rtdb } from './firebase-config';
import { child, onValue, ref } from 'firebase/database';

const User = () => {
    const Month = new Date().toJSON().slice(5, 7);
    const [dayplaytime, setDayPlayTime] = useState();
    const [monthplaytime, setMonthPlayTime] = useState();
    const [classname, setClassname] = useState();
    const [username, setUsername] = useState();
    const [musicpass, setMusicPass] = useState();
    const useruid = localStorage.getItem('ae-useruid');
    const dbRef = ref(rtdb);

    useEffect(() => {
        const musicplayRef = child(dbRef, `student/${useruid}`);
        const musicpassRef = child(dbRef, `student/${useruid}/MusicLogfile`);

        const musicplayUnsubscribe = onValue(musicplayRef, (snapshot) => {
            if (snapshot.exists()) {
                setDayPlayTime(snapshot.val().Daytotaltimeplayed);
                setMonthPlayTime(snapshot.val().Monthtotaltimeplayed);
                setClassname(snapshot.val().class);
                setUsername(snapshot.val().name.toUpperCase());
            } else {
                setDayPlayTime();
            }
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });

        const musicpassUnsubscribe = onValue(musicpassRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
                    if (value.musicplay >= 7) {
                        acc[key] = value;
                    }
                    return acc;
                }, {});

                setMusicPass(filteredData);
            } else {
                setMusicPass({});
            }
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });

        return () => {
            musicplayUnsubscribe();
            musicpassUnsubscribe();
        };

    }, [useruid, dbRef]);

    return (
        <div className={"User"}>
            <div className="User-container">
                {/* <div className='User-news'>
                    <p>
                        點數功能上線囉!! 累績點數換獎品
                    </p>

                    <p style={{
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        只要每聽7次聽力音軌就可以獲得一個 <FcApproval size={20} /> 喔!!
                    </p>
                </div> */}
                <div className="User-left">
                    <div className="User-profile-details">
                        <div className='User-profile-title'>
                            學生資料
                        </div>
                        <div className="user-info-container">
                            <div className='user-info'>
                                <div className='user-info-label'>姓名</div>
                                <div className='second-title-text'>{username || ''}</div>
                            </div>
                            <div className='user-info'>
                                <div className='user-info-label'>班級</div>
                                <div className='second-title-text'>{classname || ''} 班</div>
                            </div>
                            <div className='user-info'>
                                <div className='user-info-label'>{Month} 月聽力次數 </div>
                                <div className='second-title-text'>{monthplaytime || '0'} 次</div>
                            </div>
                            <div className='user-info'>
                                <div className='user-info-label'>今日聽力次數 </div>
                                <div className='second-title-text'>{dayplaytime || '0'} 次</div>
                            </div>
                        </div>

                    </div>
                </div>
                <div className="User-right">
                    <div className='User-passed-items'>
                        <div className='User-passed-items-title'>已通過的項目</div>
                        <div className='User-passed-items-list'>
                            {musicpass && Object.keys(musicpass).length > 0 ? (
                                <div className='User-passed-items-ul'>
                                    {Object.entries(musicpass).map(([key, value]) => (
                                        <li key={key} className='User-passed-items-li'>
                                            <div className='User-passed-items-item'>
                                                <span className='User-passed-items-key'>{key}</span>
                                                <span className='User-passed-items-playcount'>已聽過 {value.musicplay} 次</span>
                                            </div>
                                        </li>
                                    ))}
                                </div>
                            ) : (
                                <p className='User-passed-items-none'>目前無通過項目</p>
                            )}
                        </div>
                    </div>
                </div>
                <Logout />

            </div>
            <ToastContainer
                position="top-center"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />

        </div>
    );
};

export default User;


