import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { Navbar } from 'react-bootstrap';
// import { Button, Navbar } from 'react-bootstrap';
// import { Link } from 'react-router-dom';
import Brand from './Brand';
// import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

function NavBar() {
    return (
        <Navbar className='d-flex justify-content-between p-4' bg="light" expand="lg">
            <Brand />
            {/* <Button className='d-flex justify-content-center gap-1' as={Link} to="https://www.alanenglish.com.tw/" target="_blank" variant="danger">Get Started <ArrowForwardIcon /> </Button> */}
        </Navbar>
    );
}

export default NavBar;
