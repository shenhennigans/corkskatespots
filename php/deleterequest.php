<?php
    //Vars
    $to = "mischief@shenhennigans.com";
    $entryid = $_POST["locationIdDelete"];
    $entryname = $_POST["locationNameDelete"];
    $subject = "[CorkSkateSpots] Deletion Request";
    $message = "Requesting to delete entry". "\n\n" . "id:" . $entryid . "\n\n" . " name:" . $entryname;
    $redir = 'www.shenhennigans.com/corkskatespots';
    $headers = "From:" . $from;
    
    // send email
    mail($to,$subject,$message,$headers);
    
    // show message & redirect to page after 3 seconds
    echo '
    <style>
    h1 {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
    }
    .loading {
        margin: auto;
        width: 50%;
        padding: 10px;
        text-align: center;
    }
    </style>
    <div class="loading"> 
        <h1>request sent! redirecting ...</h1>
    </div>
    <script type="text/javascript">
     window.setTimeout(function(){
       location.href="../index.html";
     },3000);
    </script>';
?>