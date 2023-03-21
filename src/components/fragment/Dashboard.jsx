import React from 'react'
import Containerfull from './Containerfull'
import firebase from 'firebase/app';
import '../assets/scss/Dashboard.scss'

class Dashboard extends React.Component {
    state = {
        studentsA: null,
        studentsB: null,
        studentsC: null,
        studentsD: null,
    }
    componentDidMount() {
        const getStudents = (classParam, orderByParam, setStateFunc) => {
            const db = firebase.firestore();
            db.collection("student")
                .where('class', '==', classParam)
                .orderBy(orderByParam, 'desc')
                .get()
                .then((snapshot) => {
                    const students = [];
                    snapshot.forEach((doc) => {
                        const data = doc;
                        students.push(data);
                    })
                    setStateFunc(students);
                })
                .catch((err) => {
                    console.log(err)
                });
        }
        getStudents("A", 'onlinetime', (students) => {
            this.setState({ studentsA: students });
        });
        getStudents('B', 'onlinetime', (students) => {
            this.setState({ studentsB: students });
        });
        getStudents('C', 'onlinetime', (students) => {
            this.setState({ studentsC: students });
        });
        getStudents('D', 'onlinetime', (students) => {
            this.setState({ studentsD: students });
        });
    }

    render() {
        return (
            <>
                <Containerfull>
                    <div className='leaderboardtitle'>
                        Dashboard
                    </div>
                    <div className='notice'>
                        ⚠️ 若名字沒有在上面表示從來沒有上線過 ⚠️
                    </div>
                    {/* A班 */}
                    <div className='classtitle'>A班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>日期</span> </th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班別</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>姓名</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>次數</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>編輯</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.state.studentsA &&
                                this.state.studentsA.map((studentsA, index) => {
                                    return (
                                        <tr key={index}>
                                            <td key={studentsA.data().onlinetime}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className={studentsA.data().onlinetime ? 'text-success' || '' : 'text-danger'}>
                                                                {studentsA.data().onlinetime || '近期無上線'}
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsA.data().class}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsA.data().class ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsA.data().class || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsA.data().name}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b><span className='font-weight-bold'>{studentsA.data().name}</span></b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsA.data().email}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span
                                                                className='font-weight-bold'>{studentsA.data().totaltimeplayed}</span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsA.data().totaltimeplayed}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <a href={`/edit/${studentsA.id}`}>編輯</a>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是A班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    {/* B班 */}
                    <div className='classtitle'>B班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'>日期</span> </th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班別</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>姓名</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>次數</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>編輯</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.state.studentsB &&
                                this.state.studentsB.map((studentsB, index) => {
                                    return (
                                        <tr key={index}>
                                            <td key={studentsB.data().onlinetime}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsB.data().onlinetime ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsB.data().onlinetime || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsB.data().class}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsB.data().class ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsB.data().class || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsB.data().name}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b><span className='font-weight-bold'>{studentsB.data().name}</span></b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsB.data().email}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span
                                                                className='font-weight-bold'>{studentsB.data().totaltimeplayed}</span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsB.data().totaltimeplayed}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <a href={`/edit/${studentsB.id}`}>編輯</a>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是B班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    {/* C班 */}
                    <div className='classtitle'>C班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'>日期</span> </th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班別</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>姓名</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>次數</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>編輯</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.state.studentsC &&
                                this.state.studentsC.map((studentsC, index) => {
                                    return (
                                        <tr key={index}>
                                            <td key={studentsC.data().onlinetime}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsC.data().onlinetime ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsC.data().onlinetime || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsC.data().class}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsC.data().class ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsC.data().class || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsC.data().name}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b><span className='font-weight-bold'>{studentsC.data().name}</span></b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsC.data().email}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span
                                                                className='font-weight-bold'>{studentsC.data().totaltimeplayed}</span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsC.data().totaltimeplayed}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <a href={`/edit/${studentsC.id}`}>編輯</a>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是C班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    {/* D班 */}
                    <div className='classtitle'>D班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'>日期</span> </th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班別</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>姓名</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>次數</span></th>

                                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>編輯</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.state.studentsD &&
                                this.state.studentsD.map((studentsD, index) => {
                                    return (
                                        <tr key={index}>
                                            <td key={studentsD.data().onlinetime}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsD.data().onlinetime ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsD.data().onlinetime || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsD.data().class}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span className='font-weight-bold'>
                                                                <span className={studentsD.data().class ? 'text-success' || '' : 'text-danger'}>
                                                                    {studentsD.data().class || '近期無上線'}
                                                                </span>
                                                            </span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsD.data().name}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b><span className='font-weight-bold'>{studentsD.data().name}</span></b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsD.data().email}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <b>
                                                            <span
                                                                className='font-weight-bold'>{studentsD.data().totaltimeplayed}</span>
                                                        </b>
                                                    </div>
                                                </div>
                                            </td>
                                            <td key={studentsD.data().totaltimeplayed}>
                                                <div className='studentmain'>
                                                    <div className="studentsecond">
                                                        <a href={`/edit/${studentsD.id}`}>編輯</a>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是D班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                </Containerfull>
            </>
        )
    }
}

export default Dashboard