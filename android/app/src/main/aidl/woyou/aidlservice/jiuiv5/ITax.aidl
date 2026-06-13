// Sourced from Sunmi's official printer service AIDL
// (woyou.aidlservice.jiuiv5).
package woyou.aidlservice.jiuiv5;

interface ITax {

    oneway void onDataResult(in byte[] data);
}
