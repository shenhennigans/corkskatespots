
<?php
    // get POST vars
    // NAME
    $Name = addslashes($_POST["locationName"]);
    // TYPE - if no type is set, set to route (happens when type input is disabled)
    if(isset($_POST["locationType"])){
        $Type = $_POST["locationType"];
    } else {
        $Type = "Route";
    }
    // LEVEL
    $Level = $_POST["locationLevel"];
    // SURFACE - get any checked surface types
    $SurfaceType = '';
    if(isset($_POST["locationSurfaceType"])){
        if(in_array("Footpath", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Footpath,";
        }
        if(in_array("Cycle Path", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Cycle Path,";
        }
        if(in_array("Road", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Road,";
        }
        if(in_array("Concrete", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Concrete,";
        }
        if(in_array("Asphalt", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Asphalt,";
        }
        if(in_array("Stone Tiles", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Stone Tiles,";
        }
        if(in_array("Some rough patches", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Some rough patches,";
        }
        if(in_array("Some unskateable patches", $_POST["locationSurfaceType"])){
            $SurfaceType .= "Some unskateable patches,";
        }
        $SurfaceType = rtrim($SurfaceType, ", "); 
    }
    // COORDS
    $Lat = $_POST["locationLat"];
    $Long = $_POST["locationLong"];
    $Path = $_POST["locationPath"];
    // DISTANCE
    $Distance = $_POST["locationDistance"];
    //ELEVATION
    $Elevation = $_POST["locationElevation"];
    //ID
    $Id = $_POST["locationId"];

    //verify captcha
    if(isset($_POST['g-recaptcha-response'])){
        $captcha=$_POST['g-recaptcha-response'];
      }
    if(!$captcha){
        echo '<h2>Please check the the captcha form.</h2>';
        exit;
    }
    $secretKey = "YOURSECRETKEY";

    // post request to server
    $url = 'https://www.google.com/recaptcha/api/siteverify?secret=' . urlencode($secretKey) .  '&response=' . urlencode($captcha);
    
    //get results
    function url_get_contents ($Url) {
        if (!function_exists('curl_init')){ 
            die('CURL is not installed!');
        }
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $Url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $output = curl_exec($ch);
        curl_close($ch);
        return $output;
    }
    $response = url_get_contents($url);
    echo $response;
    $responseKeys = json_decode($response,true);
    echo $responsekeys;

    // if call was successful, continue with database call
    if($responseKeys["success"]) {
        include "./connection.php";
        // Create connection
        $conn = new mysqli($servername, $username, $password, $dbname);
        
        // Check connection
        if ($conn->connect_error) {
            die("Connection failed: " . $conn->connect_error);
        }

        // Query
        if ($Type == "Route"){
            $sql = "INSERT INTO LocationsECR (Id, Name, Type, Level, Surface_Type, Path, Distance, Elevation) VALUES ('$Id','$Name','$Type','$Level', '$SurfaceType', '$Path','$Distance','$Elevation')";
        }
        else {
            $sql = "INSERT INTO LocationsECR (Id, Name, Type, Level, Surface_Type, Lat, Lng) VALUES ('$Id','$Name','$Type','$Level','$SurfaceType','$Lat','$Long')";
        }
        
        // Evaluate query result status
        if ($conn->query($sql) === TRUE) {
            // redirect to page
            header("Location: ../index.html");
        } else {
            echo "Error: " . $sql . "" . $conn->error;
        }
        // Close connection
        $conn->close();
    } else {
        echo '<h2>access denied, please try again</h2>';
    }
?>
