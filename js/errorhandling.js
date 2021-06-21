//error handling
const errorContainer = document.getElementById('error_toast');

function throwPageError(message){
    clearErrors();
    errorContainer.innerHTML = constructErrorMessage(message);
    $("#error_toast").toast({
        delay: 3000
    });
    $("#error_toast").toast('show');
}

function constructErrorMessage(message){
    return `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
}

function clearErrors(){
    errorContainer.innerHTML = '';
}