import React from 'react';
import './css/User.scss';
import Logout from './Logout'
// import HashLoader from "react-spinners/HashLoader";
// import UserImage1 from "../assets/img/User-Image1.png";
// import UserImage2 from "../assets/img/Login.png";
import 'react-circular-progressbar/dist/styles.css';
import { ToastContainer } from "react-toastify"


const User = () => {

    const username = localStorage.getItem('ae-username');
    const classname = localStorage.getItem('ae-class');
    const currdatetimeplayed = localStorage.getItem('ae-currentdaytimeplayed');
    const totaltimeplayed = localStorage.getItem('ae-totaltimeplayed');
    const Month = new Date().toJSON().slice(5, 7);

    // const [image, setImage] = useState();
    // const [uploading, setUploading] = useState(false);
    // const [data, setData] = useState();

    // useEffect(() => {
    //     getUserInfo();
    // }, []);

    // const getUserInfo = async () => {
    //     try {
    //         const userRef = ref(rtdb, 'student/' + await localStorage.getItem('ae-userimage') + '/userimage');
    //         const snapshot = await get(userRef);
    //         const data = snapshot.val();
    //         setData(data)
    //         const storageRef = storageref(getstorage, `UserimageFile/${data}`);
    //         const downloadURL = await getDownloadURL(storageRef);
    //         setImage(downloadURL);

    //     } catch (error) {
    //         alert('Error fetching user info:', error);
    //     }
    // };

    // // Function to handle choosing an image
    // const handleChooseImage = async () => {
    //     try {
    //         // Open image picker
    //         let result = await ImagePicker.launchImageLibraryAsync({
    //             mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //             allowsEditing: true,
    //             aspect: [4, 3],
    //             quality: 1,
    //         });

    //         // Check if image was picked
    //         if (!result.canceled) {
    //             // Image URI
    //             const imageUri = result.assets[0].uri;

    //             // Upload the image to Firebase Storage
    //             await handleImageUpload(imageUri);
    //         }
    //     } catch (error) {
    //         console.error('Error choosing image:', error);
    //     }
    // };


    // // Function to handle image upload
    // const handleImageUpload = async (imageUri) => {
    //     setUploading(true);
    //     try {
    //         // Create a reference to the file to delete
    //         const desertRef = ref(getstorage, `UserimageFile/${data}`);
    //         // Delete the file
    //         deleteObject(desertRef).then(() => {
    //             alert('deleted successfully')
    //         }).catch((error) => {

    //         });
    //     } catch (e) {

    //     }
    //     try {
    //         const storage = getStorage();
    //         const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1); // Corrected
    //         const storageRef = storageref(storage, `UserimageFile/${filename}`);
    //         const response = await fetch(imageUri);
    //         const blob = await response.blob();
    //         const db = getDatabase();
    //         await update(ref(db, 'student/' + useruid), {
    //             userimage: filename,
    //         });
    //         await uploadBytes(storageRef, blob);
    //         Alert.alert('Success', 'Image uploaded successfully');
    //         getUserInfo();
    //     } catch (error) {
    //         console.error('Error uploading image:', error);
    //         Alert.alert('Error', 'Failed to upload image');
    //     } finally {
    //         setUploading(false);
    //     }
    // };


    return (
        <div className={"User"}>
            <div className="User-profile">
                <div className="User-profileDetails">
                    <div className='User-profile-title'>
                        PROFILE
                    </div>
                    {/* <div style={styles.titleContainer}>

                        <div style={{
                            backgroundColor: 'white',
                            top: 20,
                        }}>
                            {
                                image ?
                                    (
                                        <img source={{ uri: image }} alt={image} style={{
                                            width: 150,
                                            height: 150,
                                            borderRadius: 100,
                                        }} />
                                    ) : (
                                        <div>Loading...</div>
                                    )
                            }
                            <Button onPress={handleChooseImage} disabled={uploading} style={{
                                backgroundColor: '#2d7dd2',
                                padding: 10,
                                borderRadius: 10,
                                position: 'absolute',
                                right: 0,
                                bottom: 0,
                            }}>
                                <FiEdit size={20} color={'white'} />
                            </Button>
                        </div>
                        {uploading && <div style={{ justifyContent: 'center', alignContent: 'center', alignItems: 'center', marginTop: 50 }}>上傳中...</div>}
                    </div> */}
                    {/* <div className='dailycirclecontainer'>
                        <span className='howtouseicon'>
                            <img
                                style={{ width: 30, marginTop: -5 }}
                                src={Notice}
                                alt="notice"
                            />
                            <span className='howtouseicontext'>每天至少聽20次，聽一次加一顆星</span>
                        </span>
                        <div className='currentdaycircle'>
                            <CircularProgressbarWithChildren value={percentage || 'Loading...'}
                                styles={buildStyles({
                                    textColor: "red",
                                    pathColor: "gold",
                                    trailColor: `${custompathColor}`
                                })}
                            >
                                <img
                                    style={{ width: 40, marginTop: -5 }}
                                    src={Star}
                                    alt="star"
                                />
                                <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}> X {dailytimeplayed || '0'} </div>
                            </CircularProgressbarWithChildren>
                        </div>
                        <div className='abc'>
                            <div className='dailycircletext'>
                                <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}>{dailytimeplayed || '0'} </div>
                                <div className='dailycircletext2'>/ 20 次</div>
                            </div>
                            <div className='dailycircletext'>
                                <div className={dailytimeplayed >= 20 ? "complete" : 'notcomplete'}>達成目標!!!</div>
                            </div>
                        </div>
                    </div> */}

                    <div className="titleText">{username || 'NONE'}</div>
                    <div className="userInfoContainer">
                        <div>
                            <div className='userinfo'>
                                <div className='userinfolabel'>班級</div>
                                <div className='secondtitleText' >{classname || ''} 班</div>
                            </div>
                            <div className='userinfo'>
                                <div className='userinfolabel'>{Month} 月聽力次數 </div>
                                <div className='secondtitleText'>{totaltimeplayed || '0'} 次</div>
                            </div>
                            <div className='userinfo'>
                                <div className='userinfolabel'>今日聽力次數 </div>
                                <div className='secondtitleText'>{currdatetimeplayed || '0'} 次</div>
                            </div>
                        </div>
                    </div>

                    <Logout />

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
                    {/* <div>Days Learned</div> */}
                    {/* <div className='dailycirclecontainer'>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                    <div className='dailycircletext'>Mon</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Tue</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Wed</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Thur</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Fri</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Sat</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Sun</div>
                    </div>
                    
                </div> */}
                </div>
            </div>
        </div>

    )
}

export default User