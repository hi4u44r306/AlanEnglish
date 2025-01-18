import { onValue, ref, set, remove } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { rtdb } from '../Pages/firebase-config';
import '../assets/scss/EditMainNavbar.scss';

function EditMainNavbar() {
    const [navData, setNavData] = useState({});
    const [newDropdown, setNewDropdown] = useState("");
    const [newDropdownItem, setNewDropdownItem] = useState({ name: "", path: "" });
    const [selectedDropdown, setSelectedDropdown] = useState("");

    useEffect(() => {
        const navItemsRef = ref(rtdb, 'Navbar');

        const unsubscribe = onValue(navItemsRef, (snapshot) => {
            const data = snapshot.val();
            setNavData(data || {});
        });

        return () => unsubscribe(); // Clean up listener
    }, []);

    // CREATE: Add a new NavDropdown
    const handleAddDropdown = () => {
        if (!newDropdown) return alert("Enter a dropdown name.");
        const sanitizedDropdownName = newDropdown.trim().replace(/\s+/g, '_');
        if (window.confirm("Are you sure you want to add this dropdown?")) {
            const newDropdownRef = ref(rtdb, `Navbar/${sanitizedDropdownName}/0/`);
            set(newDropdownRef, ["newdata"])  // Set an empty array to represent a new dropdown
                .then(() => {
                    alert("Dropdown added successfully.");
                    setNewDropdown(""); // Clear input after success
                })
                .catch((error) => {
                    console.error("Error adding dropdown: ", error);
                    alert("Failed to add dropdown. Please try again.");
                });
        }
    };

    // CREATE: Add a new NavDropdownItem
    const handleAddDropdownItem = () => {
        if (!selectedDropdown || !newDropdownItem.name || !newDropdownItem.path) {
            return alert("Complete all fields.");
        }

        if (window.confirm("Are you sure you want to add this item?")) {
            const itemRef = ref(rtdb, `Navbar/${selectedDropdown}`);
            const updatedItems = [...(navData[selectedDropdown] || []), newDropdownItem];
            set(itemRef, updatedItems);

            setNewDropdownItem({ name: "", path: "" });
        }
    };

    // UPDATE: Modify a NavDropdownItem
    // const handleUpdateItem = (dropdownKey, itemIndex, updatedItem) => {
    //     const updatedDropdown = [...navData[dropdownKey]];
    //     updatedDropdown[itemIndex] = updatedItem;

    //     set(ref(rtdb, `Navbar/${dropdownKey}`), updatedDropdown);
    // };

    // DELETE: Remove a NavDropdown or NavDropdownItem
    const handleDelete = (dropdownKey, itemIndex = null) => {
        if (window.confirm("Are you sure you want to delete this?")) {
            if (itemIndex === null) {
                remove(ref(rtdb, `Navbar/${dropdownKey}`)); // Delete entire dropdown
            } else {
                const updatedItems = [...navData[dropdownKey]];
                updatedItems.splice(itemIndex, 1); // Remove the specific item
                set(ref(rtdb, `Navbar/${dropdownKey}`), updatedItems);
            }
        }
    };


    const renderNavItems = (data) => {
        if (!data || typeof data !== 'object') return null;

        return Object.keys(data).map((key) => {
            if (key === "課本") {
                return (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div key={key} className="nav-item-container">
                            <h3>{key}</h3>
                            {data[key].map((bookGroup, index) => (
                                <div key={index}>
                                    <h4>{bookGroup.title}</h4>
                                    <ul>
                                        {bookGroup.items.map((item, itemIndex) => (
                                            <li key={itemIndex}>
                                                <span>{item.name} - {item.path}</span>
                                                {/* <button
                                                    onClick={() =>
                                                        handleUpdateItem(key, index, { name: "Updated Name", path: "updated-path" })
                                                    }
                                                >
                                                    Update
                                                </button> */}
                                                <button onClick={() => handleDelete(key, index)}>Delete</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            } else {
                const items = data[key];
                return (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div key={key} className="nav-item-container">
                            <h3>
                                {key}
                                <button className="delete-dropdown" onClick={() => handleDelete(key)}>
                                    Delete Dropdown
                                </button>
                            </h3>
                            <ul>
                                {items.map((item, index) => (
                                    <li key={index}>
                                        <span>{item.name} - {item.path}</span>
                                        {/* <button
                                            onClick={() =>
                                                handleUpdateItem(key, index, { name: "Updated Name", path: "updated-path" })
                                            }
                                        >
                                            Update
                                        </button> */}
                                        <button onClick={() => handleDelete(key, index)}>Delete</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            }
        });
    };



    return (
        <div className="edit-navbar-container">
            <h2>Edit Navbar</h2>

            {/* Add New Dropdown */}
            <div className="add-dropdown-section">
                <input
                    type="text"
                    placeholder="New Dropdown Name"
                    value={newDropdown}
                    onChange={(e) => setNewDropdown(e.target.value)}
                />
                <button onClick={handleAddDropdown}>Add Dropdown</button>
            </div>

            {/* Add New Dropdown Item */}
            <div className="add-item-section-container">
                <div className='add-item-section'>
                    <select onChange={(e) => setSelectedDropdown(e.target.value)} value={selectedDropdown}>
                        <option value="">Select Dropdown</option>
                        {Object.keys(navData).map((key) => (
                            <option key={key} value={key}>
                                {key}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Item Name"
                        value={newDropdownItem.name}
                        onChange={(e) => setNewDropdownItem({ ...newDropdownItem, name: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Item Path"
                        value={newDropdownItem.path}
                        onChange={(e) => setNewDropdownItem({ ...newDropdownItem, path: e.target.value })}
                    />
                </div>
                <button onClick={handleAddDropdownItem}>Add Item</button>
            </div>

            {/* Render Navbar Items */}
            {renderNavItems(navData)}
        </div>

    );
}

export default EditMainNavbar;
