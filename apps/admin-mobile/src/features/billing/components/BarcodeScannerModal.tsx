import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Camera, Flashlight, FlashlightOff, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';

type Props = {
    visible: boolean;
    onClose: () => void;
    onScan: (value: string) => void;
};

/** Full-screen device camera for product barcodes and QR codes. */
export function BarcodeScannerModal({ visible, onClose, onScan }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);

    useEffect(() => {
        if (visible) {
            setScanned(false);
            setTorch(false);
        }
    }, [visible]);

    const handleScan = ({ data }: { data: string }) => {
        if (scanned || !data) return;
        setScanned(true);
        onScan(data);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={s.root}>
                <View style={s.topBar}>
                    <View>
                        <Text style={s.title}>Scan product</Text>
                        <Text style={s.subtitle}>Point the camera at a barcode or QR code</Text>
                    </View>
                    <View style={s.actions}>
                        {permission?.granted && (
                            <AppPressable
                                accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
                                onPress={() => setTorch((value) => !value)}
                                style={s.closeButton}
                            >
                                {torch ? (
                                    <FlashlightOff size={21} color="#FFFFFF" />
                                ) : (
                                    <Flashlight size={21} color="#FFFFFF" />
                                )}
                            </AppPressable>
                        )}
                        <AppPressable
                            accessibilityLabel="Close scanner"
                            onPress={onClose}
                            style={s.closeButton}
                        >
                            <X size={22} color="#FFFFFF" />
                        </AppPressable>
                    </View>
                </View>

                {!permission ? (
                    <View style={s.message}>
                        <Camera size={28} color="#FFFFFF" />
                        <Text style={s.messageTitle}>Preparing camera…</Text>
                    </View>
                ) : !permission.granted ? (
                    <View style={s.message}>
                        <Camera size={32} color="#FFFFFF" />
                        <Text style={s.messageTitle}>Camera access is needed to scan products.</Text>
                        <AppPressable onPress={() => void requestPermission()} style={s.permissionButton}>
                            <Text style={s.permissionText}>Allow camera</Text>
                        </AppPressable>
                    </View>
                ) : (
                    <View style={s.cameraWrap}>
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            enableTorch={torch}
                            barcodeScannerSettings={{
                                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                            }}
                            onBarcodeScanned={scanned ? undefined : handleScan}
                        />
                        <View style={[s.guide, { pointerEvents: 'none' }]}>
                            <View style={s.scanFrame} />
                            <Text style={s.guideText}>Align the code inside the frame</Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0D1230' },
    topBar: {
        minHeight: 92,
        paddingTop: 32,
        paddingHorizontal: 20,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
    subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 },
    closeButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    actions: { flexDirection: 'row', gap: 9 },
    cameraWrap: { flex: 1, overflow: 'hidden' },
    guide: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    scanFrame: { width: 250, height: 190, borderRadius: 24, borderWidth: 3, borderColor: '#8BA4FF' },
    guideText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 18 },
    message: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
    messageTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
    permissionButton: {
        backgroundColor: '#5B5BF7',
        borderRadius: 12,
        paddingHorizontal: 18,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
