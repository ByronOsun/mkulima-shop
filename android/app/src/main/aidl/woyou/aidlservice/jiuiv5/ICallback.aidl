// Sourced from Sunmi's official printer service AIDL
// (woyou.aidlservice.jiuiv5), used to talk to the device's built-in
// thermal printer.
package woyou.aidlservice.jiuiv5;

interface ICallback {

    oneway void onRunResult(boolean isSuccess);

    oneway void onReturnString(String result);

    oneway void onRaiseException(int code, String msg);

    oneway void onPrintResult(int code, String msg);
}
