import React, {useContext} from "react";
import "../assets/scss/SideBar.scss";
import SideBarOptions from "./SideBarOptions";
import {ThemeContext} from "../../api/Theme";
import {ExploreOutlined, HomeOutlined, PlaylistPlay, SearchOutlined} from "@material-ui/icons";

function SideBar() {
    const useStyle = useContext(ThemeContext);
    return (
        <aside style={useStyle.component} className={"aside-bar"}>
            <div className="aside-bar-container">
                {/* <p className={"p1"}>
                    <span>Library</span>
                </p> */}
                <SideBarOptions className={"lib-sub"} Icon={HomeOutlined} href={"/home"} title={"首頁"} />
                <SideBarOptions className={"lib-sub"} Icon={ExploreOutlined} href={"/home/about"}  title={"關於"}/>
                <SideBarOptions className={"lib-sub"} Icon={SearchOutlined} href={"/home/search"}  title={"搜尋"}/>
                {/* {/*<SideBarOptions className={"lib-sub"} Icon={AlbumIcon} href={"/home/album"}  title={"Album"}/> */}
                {/* <SideBarOptions className={"lib-sub"} Icon={EmojiPeopleIcon} href={"/home/artist"}  title={"Artist"}/>*/}
            </div>
            <div className="aside-bar-container playlist">
                <p className={"p1"}>
                    <span>MY PLAYLIST</span>
                </p>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/1"}  title={"習作本1"}/>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/2"}  title={"習作本2"}/>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/3"}  title={"習作本3"}/>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/4"}  title={"習作本4"}/>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/5"}  title={"習作本5"}/>
                <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} href={"/home/playlist/6"}  title={"習作本6"}/>
            </div>
        </aside>
    );
}

/*
*
* */
export default SideBar;