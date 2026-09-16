-keepattributes SourceFile,LineNumberTable
-keep class com.cuciin.laundryops.** { *; }

# Do not retain diagnostic messages containing operational data in release builds.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}
