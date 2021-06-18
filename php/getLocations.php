<?php
    include "./connection.php";

    // Create connection
    $conn = new mysqli($servername, $username, $password, $dbname);
    
    // Check connection
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    } 
    
    // Query
    $sql = "SELECT * FROM LocationsECR";
    $result = $conn->query($sql);

    // Evaluate query result
    if ($result) {
        //output data of each row
        $objList = [];
        while($row = $result->fetch_assoc()) {
            $table = array(
                "id"=>$row["Id"],
                "name"=>$row["Name"],
                "type"=>$row["Type"],
                "level"=>$row["Level"],
                "surfacetype"=>$row["Surface_Type"],
                "lat"=>$row["Lat"],
                "lng"=>$row["Lng"],
                "path"=>$row["Path"],
                "distance"=>$row["Distance"],
                "elevation"=>$row["Elevation"]
            );
            array_push($objList, $table);
        }
        // convert to json & return
        $json = json_encode($objList);
        echo $json;
    } else {
        echo "0 results";
    }
    $conn->close();
?>
