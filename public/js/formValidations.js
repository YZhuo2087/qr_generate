document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("guest-form");

  form.addEventListener("submit", (event) => {
    // Prevent form submission
    event.preventDefault();

    // Get form values
    const username = document.getElementById("username").value;
    const phone = document.getElementById("phone").value;
    const email = document.getElementById("email").value;
    const resident = document.getElementById("resident").value;
    const roomNumber = document.getElementById("room_number").value;

    // Validate username (letters only)
    const namePattern = /^[A-Za-z\s]+$/;
    if (!namePattern.test(username)) {
      alert("Username should contain letters only.");
      return;
    }

    // Validate phone (numbers only)
    const phonePattern = /^\d+$/;
    if (!phonePattern.test(phone)) {
      alert("Phone number should contain digits only.");
      return;
    }

    // Validate email (basic email pattern)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Validate resident name (letters only)
    if (!namePattern.test(resident)) {
      alert("Resident name should contain letters only.");
      return;
    }

    // Validate room number (alphanumeric)
    const roomNumberPattern = /^[A-Za-z0-9\s]+$/;
    if (!roomNumberPattern.test(roomNumber)) {
      alert("Room number should be alphanumeric.");
      return;
    }

    // Submit the form if all validations pass
    form.submit();
  });
});
