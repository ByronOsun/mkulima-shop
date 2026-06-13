package com.mkulima.agrovetpos;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * Drives the receipt printer. Two backends are supported:
 *
 * 1. The device's built-in printer, via Sunmi's "Printer Service" AIDL
 *    (woyou.aidlservice.jiuiv5.IWoyouService) - present on Sunmi POS
 *    terminals (e.g. V2 Pro).
 * 2. A paired external thermal printer over Bluetooth SPP (serial), using
 *    raw ESC/POS commands - covers most cheap Bluetooth receipt printers.
 *
 * The built-in printer is preferred when its service is available; otherwise
 * we fall back to a paired Bluetooth printer, and finally to window.print()
 * on the JS side.
 */
@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(strings = { android.Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String SUNMI_PRINTER_PACKAGE = "woyou.aidlservice.jiuiv5";
    private static final String SUNMI_PRINTER_ACTION = "woyou.aidlservice.jiuiv5.IWoyouService";

    private BluetoothSocket socket;
    private OutputStream outputStream;

    private IWoyouService builtInPrinter;

    private final ICallback noopCallback = new ICallback.Stub() {
        @Override
        public void onRunResult(boolean isSuccess) {}

        @Override
        public void onReturnString(String result) {}

        @Override
        public void onRaiseException(int code, String msg) {}

        @Override
        public void onPrintResult(int code, String msg) {}
    };

    private final ServiceConnection builtInPrinterConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            builtInPrinter = IWoyouService.Stub.asInterface(binder);
            try {
                builtInPrinter.printerInit(noopCallback);
            } catch (RemoteException ignored) {
                // If init fails the printer will still usually accept print
                // commands; surface failures from printText() instead.
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            builtInPrinter = null;
        }
    };

    @Override
    public void load() {
        Intent intent = new Intent();
        intent.setPackage(SUNMI_PRINTER_PACKAGE);
        intent.setAction(SUNMI_PRINTER_ACTION);
        try {
            getContext().bindService(intent, builtInPrinterConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception ignored) {
            // No built-in printer service on this device - fall back to
            // Bluetooth/web print.
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("builtIn", builtInPrinter != null);
        ret.put("value", builtInPrinter != null || BluetoothAdapter.getDefaultAdapter() != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "listPairedPrintersCallback");
            return;
        }
        resolvePairedPrinters(call);
    }

    @PermissionCallback
    private void listPairedPrintersCallback(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is required to list paired printers");
            return;
        }
        resolvePairedPrinters(call);
    }

    private void resolvePairedPrinters(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("This device has no Bluetooth adapter");
            return;
        }

        JSArray printers = new JSArray();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice device : bonded) {
            JSObject printer = new JSObject();
            printer.put("name", device.getName());
            printer.put("address", device.getAddress());
            printers.put(printer);
        }

        JSObject ret = new JSObject();
        ret.put("printers", printers);
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "connectCallback");
            return;
        }
        doConnect(call);
    }

    @PermissionCallback
    private void connectCallback(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is required to connect to a printer");
            return;
        }
        doConnect(call);
    }

    private void doConnect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("address is required");
            return;
        }

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("This device has no Bluetooth adapter");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(address);
            BluetoothSocket newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            newSocket.connect();

            closeSocket();
            socket = newSocket;
            outputStream = socket.getOutputStream();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to connect to printer: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        boolean cutAfter = Boolean.TRUE.equals(call.getBoolean("cut", true));

        if (builtInPrinter != null) {
            try {
                builtInPrinter.printText(text + "\n", noopCallback);
                // Feed a few lines so the receipt clears the tear bar.
                builtInPrinter.lineWrap(4, noopCallback);
                call.resolve();
            } catch (RemoteException e) {
                call.reject("Failed to print on built-in printer: " + e.getMessage(), e);
            }
            return;
        }

        if (outputStream == null) {
            call.reject("Not connected to a printer. Call connect() first.");
            return;
        }

        try {
            // ESC @ : reset printer state
            outputStream.write(new byte[] { 0x1B, 0x40 });
            outputStream.write(text.getBytes(StandardCharsets.UTF_8));
            outputStream.write('\n');
            // Feed a few lines so the cut/tear sits below the printed text
            outputStream.write(new byte[] { 0x1B, 0x64, 0x03 });
            if (cutAfter) {
                // GS V 0 : full paper cut (ignored by printers without a cutter)
                outputStream.write(new byte[] { 0x1D, 0x56, 0x00 });
            }
            outputStream.flush();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to print: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeSocket();
        call.resolve();
    }

    private void closeSocket() {
        try {
            if (outputStream != null) {
                outputStream.close();
            }
        } catch (Exception ignored) {
            // socket is being torn down anyway
        }
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (Exception ignored) {
            // socket is being torn down anyway
        } finally {
            outputStream = null;
            socket = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        closeSocket();
        try {
            getContext().unbindService(builtInPrinterConnection);
        } catch (Exception ignored) {
            // Service was never bound (no built-in printer on this device).
        }
    }
}
